import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Queryable} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission,type Principal} from '../authorization/service.js';
import {authorizeArchivedLifecycle,authorizeCreate,authorizeRecord,authorizeUpdate,authorizeWorkspaceAction,getCapabilities,getWorkspaceCapabilities,type RecordSecurityContext} from '../authorization/policy-engine.js';
import type {AuthorizationAction} from '../authorization/policy-registry.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {WorkspaceService} from '../services/workspace-service.js';
import {ensureHomeworkPicklists,readHomeworkPicklist} from '../services/homework-picklists.js';
import {validateAttachmentFile} from './work-logs.js';

const id=z.string().min(1).max(120),version=z.number().int().nonnegative();
const record=z.object({academicYearId:id,classId:id,sectionId:id,subjectId:id,teacherId:id,title:z.string().trim().min(1).max(200),instructions:z.string().trim().min(1).max(4000),assignedDate:z.string().date(),dueDate:z.string().date()}).strict();
const save=z.object({record,version,retainIds:z.array(id).max(5),newFiles:z.array(z.object({name:z.string().min(1).max(240),content:z.string().max(14*1024*1024)}).strict()).max(5)}).strict();
function parse<T>(schema:z.ZodType<T>,input:unknown):T{const r=schema.safeParse(input);if(!r.success)throw new ApiError('VALIDATION_FAILED','Check the required Homework fields.',422,{fields:r.error.issues.map(i=>i.path.join('.'))});return r.data}
const policyAction=(legacy:string):AuthorizationAction=>legacy==='publish'?'record.publish':legacy==='manage'?'record.update':'record.view';
async function permit(db:Queryable,p:Principal,action='view',explicitAction?:AuthorizationAction){{await authorizeWorkspaceAction(db,p,'homework','homework',explicitAction||policyAction(action));return}if(p.teacherId)return;requirePermission(p,'homework:'+action)}
async function securityContext(db:Queryable,p:Principal,h:any):Promise<RecordSecurityContext>{
 const recipients=(await db.query<any>("SELECT id FROM students WHERE school_id=$1 AND class_id=$2 AND ($3::text IS NULL OR section_id=$3) AND ($4::text IS NULL OR academic_year_id=$4) AND status='Active'",[p.schoolId,h.class_id,h.section_id||null,h.academic_year_id||null])).rows.map(row=>String(row.id));
 return{schoolId:p.schoolId,workspaceKey:'homework',resourceType:'homework',recordId:h.id,ownerUserId:h.created_by||null,createdByUserId:h.created_by||null,subjectStudentIds:recipients,recipientStudentIds:recipients,assignedUserIds:p.teacherId&&h.teacher_id===p.teacherId?[p.userId]:[],audienceType:h.section_id?'SECTION':'CLASS',academicYearId:h.academic_year_id||null,classId:h.class_id||null,sectionId:h.section_id||null,subjectId:h.subject_id||null,lifecycle:h.status==='Inactive'?'Archived':h.status||null,published:h.status==='Published'}
}
function acknowledgementSecurityContext(p:Principal,h:any,a:any):RecordSecurityContext{return{schoolId:p.schoolId,workspaceKey:'homework',resourceType:'homework-acknowledgement',recordId:a.id,subjectStudentIds:[String(a.studentId)],recipientStudentIds:[String(a.studentId)],audienceType:'DIRECT_RECIPIENT',academicYearId:h.academic_year_id||null,classId:h.class_id||null,sectionId:h.section_id||null,subjectId:h.subject_id||null,lifecycle:h.status==='Inactive'?'Archived':h.status||null,published:h.status==='Published'}}
function stale(){return new ApiError('RECORD_VERSION_CONFLICT','This record changed. Refresh and review before saving.',409)}
async function teaching(db:Queryable,p:Principal,h:any){
 if(!p.teacherId)return;
 if(h.teacher_id!==p.teacherId)throw new ApiError('HOMEWORK_SCOPE_DENIED','Only your assigned homework is available.',403);
 const a=await db.query('SELECT id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$2 AND class_id=$3 AND (section_id IS NULL OR section_id=$4) AND (subject_id IS NULL OR subject_id=$5) AND (academic_year_id IS NULL OR academic_year_id=$6) AND active=true AND (valid_from IS NULL OR valid_from<=CURRENT_DATE) AND (valid_until IS NULL OR valid_until>=CURRENT_DATE)',[p.schoolId,p.teacherId,h.class_id,h.section_id,h.subject_id,h.academic_year_id]);
 if(!a.rows.length)throw new ApiError('HOMEWORK_SCOPE_DENIED','This class is outside your current teaching assignments.',403);
}
async function getRow(db:Queryable,p:Principal,recordId:string,lock=false){
 const h=(await db.query<any>('SELECT * FROM homework_records WHERE school_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[p.schoolId,recordId])).rows[0];
 if(!h)throw new ApiError('HOMEWORK_NOT_FOUND','Homework not found.',404);
 if(p.studentId){
  if(h.status!=='Published')throw new ApiError('HOMEWORK_NOT_FOUND','Homework not available.',404);
  const s=(await db.query<any>("SELECT * FROM students WHERE school_id=$1 AND id=$2 AND status='Active'",[p.schoolId,p.studentId])).rows[0];
  if(!s||s.class_id!==h.class_id||(h.section_id&&s.section_id!==h.section_id)||(h.academic_year_id&&s.academic_year_id!==h.academic_year_id))throw new ApiError('HOMEWORK_NOT_FOUND','Homework not available.',404);
  await authorizeRecord(db,p,'record.view',await securityContext(db,p,h));
 }else{await permit(db,p);await teaching(db,p,h);await authorizeRecord(db,p,'record.view',await securityContext(db,p,h))}
 return h;
}
async function definition(db:Database,p:Principal,view:string){
 const service=new WorkspaceService(db);await service.syncFactories(p,'homework-workspace');
 const w=(await db.query<any>("SELECT id FROM workspace_definitions WHERE school_id=$1 AND workspace_key='homework' AND status='Active'",[p.schoolId])).rows[0];
 if(!w)throw new ApiError('WORKSPACE_UNAVAILABLE','Homework workspace is unavailable.',409);
 const d=await service.definition(db,p,w.id);
 return {...d,sections:d.sections.filter((s:any)=>{const r=s.roleVisibility.find((r:any)=>r.roleId===p.roleId);return s.enabled!==false&&s.layouts?.[view]?.visible!==false&&(view==='print'?s.printVisible!==false&&r?.printVisible!==false:s.screenVisible!==false&&r?.screenVisible!==false&&(!['create','edit'].includes(view)||r?.editVisible!==false))}).map((s:any)=>({...s,fields:s.fields.filter((f:any)=>!f.archived&&(view==='print'?f.printVisible!==false:f.screenVisible!==false))}))};
}
const mapping:Record<string,string>={academicYearId:'academic_year_id',classId:'class_id',sectionId:'section_id',subjectId:'subject_id',teacherId:'teacher_id',assignedDate:'assigned_date',dueDate:'due_date',createdAt:'created_at',updatedAt:'updated_at',createdBy:'created_by'};
function dto(h:any){const result:any={id:h.id,title:h.title,instructions:h.instructions,status:h.status,version:h.version};for(const [key,col]of Object.entries(mapping))result[key]=h[col];return result}
async function files(db:Queryable,p:Principal,homeworkId:string){return(await db.query<any>('SELECT id,name,type,size FROM homework_files WHERE school_id=$1 AND homework_id=$2 AND archived=false ORDER BY created_at,id',[p.schoolId,homeworkId])).rows}
async function references(db:Queryable,p:Principal){
 const result:any={};
 for(const [key,table] of Object.entries({years:'academic_years',classes:'classes',sections:'sections',subjects:'subjects',teachers:'staff'}))result[key]=(await db.query<any>('SELECT id,name,'+(table==='sections'?'class_id AS "classId",':'')+(table==='staff'?"status='Active'":'active')+' AS active FROM '+table+' WHERE school_id=$1 ORDER BY name',[p.schoolId])).rows;
 return result;
}
export async function registerHomeworkWorkspaceRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>{await authenticate(req,db,config,write);if(req.principal?.studentId&&(config.portalRolloutMode==='Off'||(write&&config.portalRolloutMode!=='Pilot')))throw new ApiError('PORTAL_READ_ONLY','Homework updates are not enabled for student access.',403)};
 const audit=(tx:Queryable,p:Principal,req:FastifyRequest,action:string,entityId:string)=>writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action,entityId,entityType:'Homework',outcome:'SUCCESS',correlationId:req.correlationId});
 app.get('/api/v1/homework-workspace',{preHandler:auth()},async req=>{
  const p=req.principal!;await permit(db,p);const d=await definition(db,p,'record');await db.transaction(tx=>ensureHomeworkPicklists(tx,p.schoolId));
  const rows=(await db.query<any>('SELECT * FROM homework_records WHERE school_id=$1'+(p.teacherId?' AND teacher_id=$2':'')+' ORDER BY assigned_date DESC,id',p.teacherId?[p.schoolId,p.teacherId]:[p.schoolId])).rows;
  const allFiles=(await db.query<any>('SELECT id,homework_id,name,type,size FROM homework_files WHERE school_id=$1 AND archived=false',[p.schoolId])).rows;
  const allowed=[];for(const h of rows){try{await teaching(db,p,h);await authorizeRecord(db,p,'record.view',await securityContext(db,p,h));allowed.push({...dto(h),attachments:allFiles.filter(f=>f.homework_id===h.id).map(({homework_id,...f})=>f)})}catch(e){if(!(e instanceof ApiError&&e.status===403))throw e}}
  const capabilities=await getWorkspaceCapabilities(db,p,'homework','homework',['record.update','record.publish','record.restore']);
  return{data:{items:allowed,refs:await references(db,p),definition:d,statuses:await readHomeworkPicklist(db,p.schoolId,'homeworkStatus'),teacherId:p.teacherId,permissions:{edit:capabilities['record.update'],publish:capabilities['record.publish'],restore:capabilities['record.restore']}}};
 });
 app.get('/api/v1/homework-workspace/definition',{preHandler:auth()},async req=>{const p=req.principal!;await permit(db,p);const view=String((req.query as any).view||'record');if(!['record','create','edit','print'].includes(view))throw new ApiError('VALIDATION_FAILED','Invalid view.',422);return{data:await definition(db,p,view)}});
 app.get('/api/v1/homework-workspace/:id',{preHandler:auth()},async req=>{
  const p=req.principal!,h=await getRow(db,p,String((req.params as any).id));await db.transaction(tx=>ensureHomeworkPicklists(tx,p.schoolId));
  const acknowledgementRows=(await db.query<any>('SELECT a.id,a.student_id AS "studentId",s.name AS "studentName",s.admission_number AS "admissionNumber",a.status_code AS "statusCode",a.acknowledged_at AS "acknowledgedAt",a.completed_at AS "completedAt",a.student_note AS "studentNote",a.updated_at AS "updatedAt",a.version FROM homework_acknowledgements a JOIN students s ON s.id=a.student_id AND s.school_id=a.school_id WHERE a.school_id=$1 AND a.homework_id=$2',[p.schoolId,h.id])).rows,acknowledgements=[];for(const item of acknowledgementRows)if((await getCapabilities(db,p,acknowledgementSecurityContext(p,h,item),['acknowledgement.view_status']))['acknowledgement.view_status'])acknowledgements.push(item);
  return{data:{...dto(h),attachments:await files(db,p,h.id),refs:await references(db,p),acknowledgements,ackStatuses:await readHomeworkPicklist(db,p.schoolId,'homeworkAcknowledgementStatus'),canAcknowledge:!!p.studentId&&config.portalRolloutMode==='Pilot'}};
 });
 for(const method of ['POST','PATCH'] as const)app.route({method,url:'/api/v1/homework-workspace'+(method==='PATCH'?'/:id':''),bodyLimit:72*1024*1024,preHandler:auth(true),handler:async(req,reply)=>{
  const p=req.principal!,input=parse(save,req.body),editing=method==='PATCH',recordId=editing?String((req.params as any).id):randomUUID();await permit(db,p,'manage',editing?'record.update':'record.create');const d=await definition(db,p,editing?'edit':'create');
  if(input.record.dueDate<input.record.assignedDate)throw new ApiError('INVALID_DUE_DATE','Due date cannot be before assigned date.',422);
  if(new Set(input.retainIds).size!==input.retainIds.length||input.retainIds.length+input.newFiles.length>5||(!editing&&input.retainIds.length))throw new ApiError('INVALID_ATTACHMENTS','Choose at most five attachments.',422);
  const uploads=input.newFiles.map(validateAttachmentFile);
  const result=await db.transaction(async tx=>{
   const old=editing?await getRow(tx,p,recordId,true):null;if((old?.version||0)!==input.version)throw stale();
   if(old?.status==='Inactive')throw new ApiError('HOMEWORK_INACTIVE','Restore the homework before editing.',409);
   const visible=new Set(d.sections.flatMap((s:any)=>s.fields.map((f:any)=>f.fieldKey)));
   for(const [key,value]of Object.entries(input.record))if(!visible.has(key)&&(!old||String(dto(old)[key] instanceof Date?dto(old)[key].toISOString().slice(0,10):dto(old)[key])!==value))throw new ApiError('FIELD_NOT_EDITABLE','A required field is hidden or cannot be edited in Workspace Manager.',422);
   if(!visible.has('attachments')&&(uploads.length||input.retainIds.length!==(old?await files(tx,p,recordId):[]).length))throw new ApiError('FIELD_NOT_EDITABLE','Attachments are disabled in Workspace Manager.',422);
   const r=input.record;
   for(const [key,table]of Object.entries({academicYearId:'academic_years',classId:'classes',sectionId:'sections',subjectId:'subjects',teacherId:'staff'})){
    const ref=(await tx.query<any>('SELECT * FROM '+table+' WHERE school_id=$1 AND id=$2 AND '+(table==='staff'?"status='Active'":'active=true'),[p.schoolId,(r as any)[key]])).rows[0];
    if(!ref||(key==='sectionId'&&ref.class_id!==r.classId))throw new ApiError('INVALID_RECORD_REFERENCE','Choose an active reference belonging to this school and class.',422);
   }
   const proposed={id:recordId,academic_year_id:r.academicYearId,class_id:r.classId,section_id:r.sectionId,subject_id:r.subjectId,teacher_id:r.teacherId,created_by:old?.created_by||p.userId,status:old?.status||'Draft'};await teaching(tx,p,proposed);
   {if(old)await authorizeUpdate(tx,p,await securityContext(tx,p,old),await securityContext(tx,p,proposed));else await authorizeCreate(tx,p,await securityContext(tx,p,proposed))}
   const hasHistory=old&&(old.status==='Published'||old.published_at||(await tx.query('SELECT id FROM homework_acknowledgements WHERE school_id=$1 AND homework_id=$2 LIMIT 1',[p.schoolId,recordId])).rows.length>0);
   if(hasHistory&&['academicYearId','classId','sectionId','subjectId','teacherId'].some(k=>(r as any)[k]!==dto(old)[k]))throw new ApiError('PUBLISHED_AUDIENCE_LOCKED','Published recipients cannot be changed. Create a new assignment instead.',409);
   const retained=old?await files(tx,p,recordId):[];if(input.retainIds.some(id=>!retained.some(f=>f.id===id)))throw new ApiError('INVALID_ATTACHMENTS','An attachment does not belong to this homework.',422);{const context=await securityContext(tx,p,proposed);if(uploads.length)await authorizeRecord(tx,p,'attachment.upload',context);if(retained.some(f=>!input.retainIds.includes(f.id)))await authorizeRecord(tx,p,'attachment.delete',context)}
   const vals=[r.academicYearId,r.classId,r.sectionId,r.subjectId,r.teacherId,r.title,r.instructions,r.assignedDate,r.dueDate];
   if(old){const changed=await tx.query('UPDATE homework_records SET academic_year_id=$1,class_id=$2,section_id=$3,subject_id=$4,teacher_id=$5,title=$6,instructions=$7,assigned_date=$8,due_date=$9,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$10 AND id=$11 AND version=$12 RETURNING id',[...vals,p.schoolId,recordId,input.version]);if(!changed.rows.length)throw stale()}
   else{await ensureHomeworkPicklists(tx,p.schoolId);const options=await readHomeworkPicklist(tx,p.schoolId,'homeworkStatus');if(!options.some(x=>x.value==='Draft'&&x.active))throw new ApiError('STATUS_UNAVAILABLE','Activate Draft in Homework Status.',409);await tx.query("INSERT INTO homework_records(academic_year_id,class_id,section_id,subject_id,teacher_id,title,instructions,assigned_date,due_date,school_id,id,created_by,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Draft')",[...vals,p.schoolId,recordId,p.userId])}
   for(const f of retained)if(!input.retainIds.includes(f.id))await tx.query('UPDATE homework_files SET archived=true WHERE school_id=$1 AND id=$2',[p.schoolId,f.id]);
   for(const f of uploads)await tx.query('INSERT INTO homework_files(id,school_id,homework_id,name,type,size,content) VALUES($1,$2,$3,$4,$5,$6,$7)',[f.id,p.schoolId,recordId,f.name,f.type,f.size,f.content]);
   await audit(tx,p,req,editing?'HOMEWORK_UPDATED':'HOMEWORK_CREATED',recordId);return{id:recordId,version:input.version+1,status:old?.status||'Draft'};
  });return reply.code(editing?200:201).send({data:result});
 }});
 app.post('/api/v1/homework-workspace/:id/:action',{preHandler:auth(true)},async req=>{
  const p=req.principal!,{id:recordId,action}=req.params as any,input=parse(z.object({version}).strict(),req.body);if(!['publish','deactivate','restore'].includes(action))throw new ApiError('NOT_FOUND','Action not found.',404);const actionPolicy:AuthorizationAction=action==='publish'?'record.publish':action==='restore'?'record.restore':'record.archive';await permit(db,p,action==='publish'?'publish':'manage',actionPolicy);
  return{data:await db.transaction(async tx=>{const h=await getRow(tx,p,recordId,true);{const context=await securityContext(tx,p,h);if(action==='restore')await authorizeArchivedLifecycle(tx,p,'record.restore',context);else await authorizeRecord(tx,p,actionPolicy,context)}if(h.version!==input.version)throw stale();if(action==='publish'?h.status!=='Draft':action==='restore'?h.status!=='Inactive':h.status==='Inactive')throw new ApiError('INVALID_TRANSITION','This action is unavailable for the current status.',409);
   const status=action==='publish'?'Published':action==='restore'?'Draft':'Inactive';await ensureHomeworkPicklists(tx,p.schoolId);if(!(await readHomeworkPicklist(tx,p.schoolId,'homeworkStatus')).some(x=>x.value===status&&x.active))throw new ApiError('STATUS_UNAVAILABLE','Activate this status in Homework Status.',409);
   await tx.query('UPDATE homework_records SET status=$1,version=version+1,updated_at=CURRENT_TIMESTAMP,'+(action==='publish'?'published_at=CURRENT_TIMESTAMP':action==='deactivate'?'deactivated_at=CURRENT_TIMESTAMP':'deactivated_at=NULL')+' WHERE school_id=$2 AND id=$3',[status,p.schoolId,recordId]);await audit(tx,p,req,'HOMEWORK_'+action.toUpperCase(),recordId);return{id:recordId,status,version:h.version+1}})};
 });
 app.put('/api/v1/homework-workspace/:id/acknowledgement',{preHandler:auth(true)},async req=>{
  const p=req.principal!;if(!p.studentId)throw new ApiError('STUDENT_ONLY','Only a linked student can acknowledge homework.',403);
  const input=parse(z.object({statusCode:z.string().min(1).max(200),studentNote:z.string().max(1000).default(''),version}).strict(),req.body),recordId=String((req.params as any).id);
  return{data:await db.transaction(async tx=>{const h=await getRow(tx,p,recordId,true);await authorizeRecord(tx,p,'record.acknowledge',await securityContext(tx,p,h));await ensureHomeworkPicklists(tx,p.schoolId);if(!(await readHomeworkPicklist(tx,p.schoolId,'homeworkAcknowledgementStatus')).some(x=>x.value===input.statusCode&&x.active))throw new ApiError('STATUS_UNAVAILABLE','Choose an active acknowledgement status.',422);
   const old=(await tx.query<any>('SELECT * FROM homework_acknowledgements WHERE school_id=$1 AND homework_id=$2 AND student_id=$3',[p.schoolId,recordId,p.studentId])).rows[0];if((old?.version||0)!==input.version)throw stale();
   const completed=input.statusCode==='COMPLETED'?(old?.completed_at||new Date()):null;
   if(old)await tx.query('UPDATE homework_acknowledgements SET status_code=$1,student_note=$2,completed_at=$3,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=$4 AND school_id=$5',[input.statusCode,input.studentNote,completed,old.id,p.schoolId]);
   else await tx.query('INSERT INTO homework_acknowledgements(id,school_id,homework_id,student_id,status_code,student_note,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),p.schoolId,recordId,p.studentId,input.statusCode,input.studentNote,completed]);
   await audit(tx,p,req,'HOMEWORK_ACKNOWLEDGED',recordId);return{statusCode:input.statusCode,version:input.version+1}})};
 });
 app.get('/api/v1/homework-files/:id',{preHandler:auth()},async req=>{const p=req.principal!,f=(await db.query<any>('SELECT * FROM homework_files WHERE school_id=$1 AND id=$2 AND archived=false',[p.schoolId,String((req.params as any).id)])).rows[0];if(!f)throw new ApiError('NOT_FOUND','Attachment not found.',404);const h=await getRow(db,p,f.homework_id);await authorizeRecord(db,p,'attachment.view',await securityContext(db,p,h));return{data:{name:f.name,type:f.type,content:f.content}}});
}

