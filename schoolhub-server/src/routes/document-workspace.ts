import {authorizeArchivedLifecycle} from '../authorization/policy-engine.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import type {Principal} from '../authorization/service.js';
import {authenticate} from '../auth/security.js';
import {requirePermission,assertTeacherStudentScope} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {WorkspaceService} from '../services/workspace-service.js';
import {CoreRelationshipRepository} from '../repositories/core-relationship-repository.js';
import {readHomeworkPicklist} from '../services/homework-picklists.js';
import {validateAttachmentFile} from './work-logs.js';
const id=z.string().min(1).max(120),ref=id.nullable();
const record=z.object({name:z.string().trim().min(1).max(240),cat:z.string().min(1).max(120),audiences:z.array(z.string().min(1).max(120)).min(1).max(20),description:z.string().max(10000),tags:z.array(z.string().trim().min(1).max(80)).max(30),documentVersion:z.string().max(80),effectiveDate:z.string().date().nullable(),expiryDate:z.string().date().nullable(),status:z.enum(['Draft','Active','Inactive','Archived']),requiresAcknowledgement:z.boolean(),portalVisible:z.boolean(),internalRemarks:z.string().max(10000),classId:ref,sectionId:ref,studentId:ref,teacherId:ref}).strict();
const schema=z.object({record,version:z.number().int().nonnegative(),retainIds:z.array(id).max(5),newFiles:z.array(z.object({name:z.string().min(1).max(240),content:z.string().max(14*1024*1024)}).strict()).max(5)}).strict();
export function documentStaffOnly(p:Principal){if(p.studentId||p.guardianId)throw new ApiError('PORTAL_NOT_AVAILABLE','Document portal access is not enabled.',403);}
const can=(p:Principal,key:string)=>p.systemRecovery===true||p.permissions.includes(key);
export function documentData(row:any,p:Principal){
 const d={...row.data};if(!can(p,'documents:update'))delete d.internalRemarks;
 return {...d,id:row.id,version:row.version,status:row.archived?'Archived':d.status||'Active',audiences:Array.isArray(d.audiences)?d.audiences:(d.aud?[d.aud]:[]),tags:Array.isArray(d.tags)?d.tags:[],createdAt:row.created_at,updatedAt:row.updated_at,archived:row.archived};
}
export async function registerDocumentWorkspaceRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>{await authenticate(req,db,config,write);documentStaffOnly(req.principal!)},core=new CoreRelationshipRepository(db);
 app.get('/api/v1/document-workspace',{preHandler:auth()},async req=>{
  const p=req.principal!;requirePermission(p,'documents:view');const ws=new WorkspaceService(db);await ws.syncFactories(p,'document-workspace');
  const w=(await db.query<any>("SELECT id FROM workspace_definitions WHERE school_id=$1 AND workspace_key='documents'",[p.schoolId])).rows[0];
  const all=(await db.query<any>("SELECT * FROM school_content_records WHERE school_id=$1 AND kind='documents' ORDER BY updated_at DESC,id",[p.schoolId])).rows;
  const rows=all.filter(x=>can(p,'documents:update')||(!x.archived&&(x.data.status!=='Draft'||x.data.createdBy===p.userId)));
  const files=(await db.query<any>('SELECT id,document_id,name,type,size FROM document_files WHERE school_id=$1 AND archived=false',[p.schoolId])).rows;
  for(const [key,values]of [['documentCategory',all.map(x=>x.data.cat)],['documentAudience',all.flatMap(x=>x.data.audiences||[x.data.aud])]] as [string,any[]][]){
   const list=(await db.query<any>('SELECT id FROM picklist_definitions WHERE school_id=$1 AND picklist_key=$2',[p.schoolId,key])).rows[0];
   if(list)for(const value of new Set(values.filter(v=>typeof v==='string'&&v.length>0&&v.length<=120)))await db.query('INSERT INTO picklist_values(id,school_id,picklist_id,value,label,sort_order) VALUES($1,$2,$3,$4,$4,100) ON CONFLICT(picklist_id,value) DO NOTHING',[randomUUID(),p.schoolId,list.id,value]);
  }
  const editing=can(p,'documents:create')||can(p,'documents:update'),refs:any={classes:[],sections:[],teachers:[],students:[]};
  if(editing){
   const [classes,sections,staff]=await Promise.all([core.list(p,'classes'),core.list(p,'sections'),core.list(p,'staff')]);
   refs.classes=classes.items.map(x=>({id:x.id,name:x.name,active:x.active}));refs.sections=sections.items.map(x=>({id:x.id,name:x.name,classId:x.classId,active:x.active}));refs.teachers=staff.items.map(x=>({id:x.id,name:x.name,active:x.status==='Active'}));
   for(const s of(await db.query<any>("SELECT id,name,class_id,section_id,academic_year_id,status FROM students WHERE school_id=$1",[p.schoolId])).rows){try{await assertTeacherStudentScope(db,p,s);refs.students.push({id:s.id,name:s.name,classId:s.class_id,sectionId:s.section_id,active:s.status==='Active'})}catch(e){if(!(e instanceof ApiError&&e.status===403))throw e}}
  }
  const items=[];for(const row of rows){
   const x=documentData(row,p);const targets:any={};
   for(const [key,table]of [['classId','classes'],['sectionId','sections'],['studentId','students'],['teacherId','staff']])if(x[key])targets[key]=(await db.query<any>('SELECT name FROM '+table+' WHERE school_id=$1 AND id=$2',[p.schoolId,x[key]])).rows[0]?.name||'Unavailable record';
   const creator=x.createdBy?(await db.query<any>('SELECT username FROM users WHERE school_id=$1 AND id=$2',[p.schoolId,x.createdBy])).rows[0]?.username:null;
   items.push({...x,createdByName:creator||x.createdByName||'Not recorded',targetNames:targets,attachments:files.filter(f=>f.document_id===x.id)});
  }
  return{data:{items,...refs,definition:await ws.definition(db,p,w.id),categories:await readHomeworkPicklist(db,p.schoolId,'documentCategory'),statuses:await readHomeworkPicklist(db,p.schoolId,'documentStatus'),audiences:await readHomeworkPicklist(db,p.schoolId,'documentAudience')}};
 });
 for(const method of ['POST','PATCH']as const)app.route({method,url:'/api/v1/document-workspace'+(method==='PATCH'?'/:id':''),preHandler:auth(true),bodyLimit:72*1024*1024,handler:async(req,reply)=>{
  const p=req.principal!,editing=method==='PATCH';requirePermission(p,editing?'documents:update':'documents:create');
  const parsed=schema.safeParse(req.body);if(!parsed.success)throw new ApiError('VALIDATION_FAILED','Check document fields, dates and attachments.',422);
  const input=parsed.data,r=input.record,docId=editing?String((req.params as any).id):randomUUID();
  if(r.status==='Archived')requirePermission(p,'documents:delete');
  if(r.effectiveDate&&r.expiryDate&&r.expiryDate<r.effectiveDate)throw new ApiError('INVALID_DATE_RANGE','Expiry Date must be on or after Effective Date.',422);
  if(new Set(r.audiences).size!==r.audiences.length||r.audiences.includes('All')&&r.audiences.length>1)throw new ApiError('INVALID_AUDIENCE','Choose All alone, or specific audiences.',422);
  if(r.sectionId&&!r.classId||r.audiences.includes('Class')&&!r.classId||r.audiences.includes('Section')&&!r.sectionId||r.audiences.includes('Individual')&&!r.studentId&&!r.teacherId)throw new ApiError('REFERENCE_REQUIRED','Select a related class, section or individual for the chosen audience.',422);
  if(input.retainIds.length+input.newFiles.length>5||new Set(input.retainIds).size!==input.retainIds.length||!editing&&input.retainIds.length)throw new ApiError('INVALID_ATTACHMENTS','Select up to five attachments.',422);
  const uploads=input.newFiles.map(validateAttachmentFile);
  await db.transaction(async tx=>{
   const old=editing?(await tx.query<any>("SELECT * FROM school_content_records WHERE school_id=$1 AND id=$2 AND kind='documents' FOR UPDATE",[p.schoolId,docId])).rows[0]:null;
   if(editing&&(!old||old.archived))throw new ApiError('NOT_FOUND','Restore the archived document before editing.',404);
   if((old?.version||0)!==input.version)throw new ApiError('RECORD_VERSION_CONFLICT','This document changed. Reload before saving.',409);
   for(const [key,values,prior]of [['documentCategory',[r.cat],[old?.data.cat]],['documentStatus',[r.status],[old?.data.status||'Active']],['documentAudience',r.audiences,old?.data.audiences||[old?.data.aud]]]as [string,string[],string[]][]){
    const options=await readHomeworkPicklist(tx,p.schoolId,key);for(const value of values)if(!prior.includes(value)&&!options.some(v=>v.active&&v.value===value))throw new ApiError('INVALID_PICKLIST','Choose active values from Picklist Manager.',422);
   }
   for(const [key,table]of [['classId','classes'],['sectionId','sections'],['studentId','students'],['teacherId','staff']]as const){const rid=r[key];if(!rid)continue;const target=(await tx.query<any>('SELECT * FROM '+table+' WHERE school_id=$1 AND id=$2',[p.schoolId,rid])).rows[0];
    if(!target||((table==='classes'||table==='sections'?target.active!==true:target.status!=='Active')&&old?.data[key]!==rid))throw new ApiError('INVALID_REFERENCE','Choose related records from this school.',422);
    if(table==='sections'&&target.class_id!==r.classId)throw new ApiError('INVALID_REFERENCE','Section must belong to the selected class.',422);
    if(table==='students'){await assertTeacherStudentScope(tx,p,target);if(r.classId&&target.class_id!==r.classId||r.sectionId&&target.section_id!==r.sectionId)throw new ApiError('INVALID_REFERENCE','Student does not belong to the selected class/section.',422)}
    if(!!p.teacherId&&table==='staff'&&rid!==p.teacherId)throw new ApiError('FORBIDDEN','Teacher is outside your scope.',403);
   }
   if(!!p.teacherId&&r.classId&&!(await core.list(p,'classes')).items.some(x=>x.id===r.classId))throw new ApiError('FORBIDDEN','Class is outside your scope.',403);
   const files=(await tx.query<any>('SELECT id FROM document_files WHERE school_id=$1 AND document_id=$2 AND archived=false',[p.schoolId,docId])).rows;
   if(input.retainIds.some(fid=>!files.some(f=>f.id===fid)))throw new ApiError('INVALID_ATTACHMENTS','Attachment does not belong to this document.',422);
   if(!can(p,'documents:update')&&r.internalRemarks)throw new ApiError('FORBIDDEN','Internal remarks require document edit permission.',403);
   const data={...(old?.data||{}),...r,tags:[...new Set(r.tags)],aud:r.audiences.join(', '),createdBy:old?old.data.createdBy||null:p.userId,createdByName:old?old.data.createdByName||'Not recorded':p.username};
   if(editing)await tx.query('UPDATE school_content_records SET data=$1,archived=$2,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$3 AND id=$4',[JSON.stringify(data),r.status==='Archived',p.schoolId,docId]);
   else await tx.query("INSERT INTO school_content_records(id,school_id,kind,record_key,data,archived) VALUES($1,$2,'documents',$1,$3,$4)",[docId,p.schoolId,JSON.stringify(data),r.status==='Archived']);
   for(const f of files)if(!input.retainIds.includes(f.id))await tx.query('UPDATE document_files SET archived=true WHERE school_id=$1 AND id=$2',[p.schoolId,f.id]);
   for(const f of uploads)await tx.query('INSERT INTO document_files(id,school_id,document_id,name,type,size,content) VALUES($1,$2,$3,$4,$5,$6,$7)',[f.id,p.schoolId,docId,f.name,f.type,f.size,f.content]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:editing?'DOCUMENT_UPDATED':'DOCUMENT_CREATED',entityType:'documents',entityId:docId,outcome:'SUCCESS',correlationId:req.correlationId});
  });return reply.code(editing?200:201).send({data:{id:docId}});
 }});
 for(const action of ['archive','restore'])app.post('/api/v1/document-workspace/:id/'+action,{preHandler:auth(true)},async req=>{
  const p=req.principal!;if(action==='archive')requirePermission(p,'documents:delete');
  const parsed=z.object({version:z.number().int().positive()}).strict().safeParse(req.body);if(!parsed.success)throw new ApiError('VALIDATION_FAILED','Record version is required.',422);const docId=String((req.params as any).id);
  await db.transaction(async tx=>{
   const old=(await tx.query<any>("SELECT * FROM school_content_records WHERE school_id=$1 AND id=$2 AND kind='documents' FOR UPDATE",[p.schoolId,docId])).rows[0];
   if(!old||old.version!==parsed.data.version||old.archived!==(action==='restore'))throw new ApiError('RECORD_VERSION_CONFLICT','Document changed or is unavailable. Reload the list.',409);
   if(action==='restore')await authorizeArchivedLifecycle(tx,p,'record.restore',{schoolId:p.schoolId,workspaceKey:'documents',resourceType:'document',recordId:docId,ownerUserId:old.data.createdBy||null,createdByUserId:old.data.createdBy||null,classId:old.data.classId||null,sectionId:old.data.sectionId||null,lifecycle:old.archived?'Archived':'Active'});
   const data={...old.data,status:action==='archive'?'Archived':'Inactive'};
   await tx.query('UPDATE school_content_records SET data=$1,archived=$2,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$3 AND id=$4',[JSON.stringify(data),action==='archive',p.schoolId,docId]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:action==='archive'?'DOCUMENT_ARCHIVED':'DOCUMENT_RESTORED',entityType:'documents',entityId:docId,outcome:'SUCCESS',correlationId:req.correlationId});
  });return{data:{success:true}};
 });
 app.get('/api/v1/document-files/:id',{preHandler:auth()},async req=>{
  const p=req.principal!;requirePermission(p,'documents:view');const f=(await db.query<any>("SELECT f.name,f.type,f.content,d.data,d.archived FROM document_files f JOIN school_content_records d ON d.id=f.document_id AND d.school_id=f.school_id WHERE f.school_id=$1 AND f.id=$2 AND f.archived=false AND d.kind='documents'",[p.schoolId,String((req.params as any).id)])).rows[0];
  if(!f||((f.archived||(f.data.status==='Draft'&&f.data.createdBy!==p.userId))&&!can(p,'documents:update')))throw new ApiError('NOT_FOUND','Attachment not found.',404);
  return{data:{name:f.name,type:f.type,content:f.content}};
 });
}

