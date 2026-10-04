import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Queryable} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission,assertTeacherStudentScope,type Principal} from '../authorization/service.js';
import {authorizeCreate,authorizeRecord,authorizeUpdate,authorizeWorkspaceAction,getCapabilities,resolveEffectiveGrants,type RecordSecurityContext} from '../authorization/policy-engine.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {WorkspaceService} from '../services/workspace-service.js';
import {ensureHomeworkPicklists,readHomeworkPicklist} from '../services/homework-picklists.js';
import {startWorkflow,workflowSettings} from '../services/operations-workflows.js';
import {validateAttachmentFile} from './work-logs.js';
const id=z.string().min(1).max(120);
const schema=z.object({applicantType:z.enum(['Student','Staff']),applicantId:id,type:z.string().min(1).max(100),from:z.string().date(),to:z.string().date(),reason:z.string().trim().min(1).max(10000),priority:z.string().max(120),version:z.number().int().nonnegative(),retainIds:z.array(id).max(1),newFiles:z.array(z.object({name:z.string().min(1).max(240),content:z.string().max(7*1024*1024)}).strict()).max(1)}).strict().refine(x=>x.from<=x.to,{message:'From Date must not be after To Date.'});
const allowed=(p:Principal,key:string)=>p.systemRecovery===true||p.permissions.includes(key);
function leaveContext(p:Principal,row:any):RecordSecurityContext{const data=row?.data||row||{};return{schoolId:p.schoolId,workspaceKey:'leave-requests',resourceType:'leave-request',recordId:row?.id,ownerUserId:data.submittedBy||null,createdByUserId:data.submittedBy||null,subjectStudentIds:data.studentId?[String(data.studentId)]:[],subjectStaffIds:data.staffId?[String(data.staffId)]:[],lifecycle:data.status||'Pending'}}
async function leavePredicate(db:Queryable,p:Principal,alias:string){
 await authorizeWorkspaceAction(db,p,'leave-requests','leave-request','record.view');const grants=(await resolveEffectiveGrants(db,p,'leave-requests','leave-request')).filter(grant=>grant.action==='record.view'),values:any[]=[p.schoolId],clauses:string[]=[];
 for(const grant of grants){if(grant.scope==='ALL_WORKSPACE')clauses.push('TRUE');else if(grant.scope==='OWNED'||grant.scope==='CREATED_BY'){values.push(p.userId);clauses.push(alias+".data->>'submittedBy'=$"+values.length)}else if(grant.scope==='SELF'){const own:string[]=[];if(p.studentId){values.push(p.studentId);own.push(alias+".data->>'studentId'=$"+values.length)}if(p.teacherId){values.push(p.teacherId);own.push(alias+".data->>'staffId'=$"+values.length)}if(own.length)clauses.push('('+own.join(' OR ')+')')}else if(grant.scope==='CHILD_PERSONAL'&&p.guardianId){values.push(p.guardianId);clauses.push("EXISTS(SELECT 1 FROM guardian_student_links gsl WHERE gsl.school_id=$1 AND gsl.guardian_id=$"+values.length+" AND gsl.student_id="+alias+".data->>'studentId' AND gsl.active=true)")}}
 return{sql:clauses.length?'('+clauses.join(' OR ')+')':'FALSE',values};
}
async function applicant(tx:Queryable,p:Principal,type:string,id:string){
 const table=type==='Student'?'students':'staff',r=(await tx.query<any>('SELECT * FROM '+table+' WHERE school_id=$1 AND id=$2 AND status=$3',[p.schoolId,id,'Active'])).rows[0];
 if(!r)throw new ApiError('APPLICANT_NOT_FOUND','Choose an active applicant from this school.',422);
 if(type==='Student')await assertTeacherStudentScope(tx,p,r,true);
 else if(!!p.teacherId&&p.teacherId!==id)throw new ApiError('FORBIDDEN','Choose your own staff record.',403);
 return r;
}
export async function registerLeaveWorkspaceRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 app.get('/api/v1/leave-workspace',{preHandler:auth()},async req=>{
  const p=req.principal!;requirePermission(p,'leave:view');const filter=await leavePredicate(db,p,'l'),ws=new WorkspaceService(db);await ws.syncFactories(p,'leave-workspace');await ensureHomeworkPicklists(db,p.schoolId);
  const w=(await db.query<any>("SELECT id FROM workspace_definitions WHERE school_id=$1 AND workspace_key='leave-requests'",[p.schoolId])).rows[0],definition=await ws.definition(db,p,w.id);
  const rows=(await db.query<any>('SELECT l.id,l.data,l.version,l.created_at,l.updated_at FROM school_leave_requests l WHERE l.school_id=$1 AND l.archived=false AND '+filter.sql+' ORDER BY l.created_at DESC,l.id',filter.values)).rows;
  const typeList=(await db.query<any>("SELECT id FROM picklist_definitions WHERE school_id=$1 AND picklist_key='leaveType'",[p.schoolId])).rows[0];
  if(typeList)for(const value of new Set<string>(rows.map(r=>r.data.type).filter(v=>typeof v==='string'&&v.length>0&&v.length<=100)))await db.query('INSERT INTO picklist_values(id,school_id,picklist_id,value,label,sort_order) VALUES($1,$2,$3,$4,$4,100) ON CONFLICT(picklist_id,value) DO NOTHING',[randomUUID(),p.schoolId,typeList.id,value]);
  const instances=(await db.query<any>("SELECT data FROM operation_workflow_instances WHERE school_id=$1 AND subject_type='leave'",[p.schoolId])).rows.map(x=>x.data);
  const students=(await db.query<any>('SELECT id,name,admission_number,class_id,section_id,academic_year_id,status FROM students WHERE school_id=$1',[p.schoolId])).rows,staff=(await db.query<any>('SELECT id,name,status FROM staff WHERE school_id=$1',[p.schoolId])).rows,files=(await db.query<any>('SELECT id,leave_id,name,type,size FROM leave_files WHERE school_id=$1 AND archived=false',[p.schoolId])).rows;
  const refs:any[]=[];if(allowed(p,'leave:create')||allowed(p,'leave:update')){for(const s of students.filter(x=>x.status==='Active')){const capabilities=await getCapabilities(db,p,leaveContext(p,{studentId:s.id,status:'Pending'}),['record.create','record.update']);if(capabilities['record.create']||capabilities['record.update'])refs.push({id:s.id,name:s.name,detail:s.admission_number,applicantType:'Student'})}for(const s of staff.filter(x=>x.status==='Active')){const capabilities=await getCapabilities(db,p,leaveContext(p,{staffId:s.id,status:'Pending'}),['record.create','record.update']);if(capabilities['record.create']||capabilities['record.update'])refs.push({id:s.id,name:s.name,applicantType:'Staff'})}}
  const items=rows.map(r=>{const d=r.data,inst=instances.find(x=>x.subjectId===r.id),step=inst?.stepsSnapshot.find((s:any)=>s.id===inst.currentStepId),person=d.studentId?students.find(s=>s.id===d.studentId):d.staffId?staff.find(s=>s.id===d.staffId):null,history=inst?.history||[],last=[...history].reverse().find(x=>['Approved','Rejected'].includes(x.action));return{...d,id:r.id,version:r.version,applicant:person?.name||d.applicant,applicantType:d.applicantType||'Not recorded',createdAt:r.created_at,updatedAt:r.updated_at,submittedAt:d.submittedAt||r.created_at,submittedByName:d.submittedByName||history[0]?.actor||'Not recorded',decisionByName:d.decisionByName||(d.status!=='Pending'?last?.actor:null),decisionAt:d.decisionAt||(d.status!=='Pending'?last?.timestamp:null),attachments:files.filter(f=>f.leave_id===r.id),canEdit:allowed(p,'leave:update')&&d.status==='Pending'&&!!(d.studentId||d.staffId)&&!history.some((x:any)=>x.action!=='Created'),canDecide:allowed(p,'leave:update')&&d.status==='Pending'&&inst?.status==='In Progress'&&!!step&&(!step.responsibleRoleId||step.responsibleRoleId===p.roleId),stage:step?.name||''}});
  return{data:{items,refs,definition,applicantTypes:await readHomeworkPicklist(db,p.schoolId,'leaveApplicantType'),types:await readHomeworkPicklist(db,p.schoolId,'leaveType'),statuses:await readHomeworkPicklist(db,p.schoolId,'leaveStatus'),priorities:await readHomeworkPicklist(db,p.schoolId,'leavePriority'),requireRejectionReason:(await workflowSettings(db,p.schoolId)).policies['leave.requireRejectionReason']!==false}};
 });
 for(const method of ['POST','PATCH'] as const)app.route({method,url:'/api/v1/leave-workspace'+(method==='PATCH'?'/:id':''),preHandler:auth(true),bodyLimit:8*1024*1024,handler:async(req,reply)=>{
  const p=req.principal!,editing=method==='PATCH';requirePermission(p,editing?'leave:update':'leave:create');const parsed=schema.safeParse(req.body);if(!parsed.success)throw new ApiError('VALIDATION_FAILED','Check required fields and the date range.',422);const r=parsed.data,recordId=editing?String((req.params as any).id):randomUUID();
  if(r.newFiles.length+r.retainIds.length>1||(!editing&&r.retainIds.length))throw new ApiError('INVALID_ATTACHMENT','Attach one PDF, JPG or PNG, up to 5 MB.',422);
  const uploads=r.newFiles.map(f=>{const out=validateAttachmentFile(f);if(out.size>5*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(out.type))throw new ApiError('INVALID_ATTACHMENT','Attach one PDF, JPG or PNG, up to 5 MB.',422);return out});
  await db.transaction(async tx=>{
   const old=editing?(await tx.query<any>('SELECT data,version FROM school_leave_requests WHERE school_id=$1 AND id=$2 AND archived=false FOR UPDATE',[p.schoolId,recordId])).rows[0]:null;
   if(editing&&!old)throw new ApiError('NOT_FOUND','Leave request not found.',404);
   if((old?.version||0)!==r.version)throw new ApiError('RECORD_VERSION_CONFLICT','This request changed. Reload before saving.',409);
   let instance:any;if(editing){instance=(await tx.query<any>("SELECT id,data,version FROM operation_workflow_instances WHERE school_id=$1 AND subject_type='leave' AND subject_id=$2 FOR UPDATE",[p.schoolId,recordId])).rows[0];if(old.data.status!=='Pending'||!instance||instance.data.status!=='In Progress'||instance.data.history.some((h:any)=>h.action!=='Created'))throw new ApiError('LEAVE_READ_ONLY','A request under review or already decided cannot be edited.',409);}
   const person=await applicant(tx,p,r.applicantType,r.applicantId);
   for(const [key,value,oldValue]of [['leaveType',r.type,old?.data.type],['leaveApplicantType',r.applicantType,old?.data.applicantType],['leavePriority',r.priority,old?.data.priority]])if(value&&value!==oldValue&&!(await readHomeworkPicklist(tx,p.schoolId,key)).some(x=>x.active&&x.value===value))throw new ApiError('INVALID_PICKLIST','Select an active Picklist value.',422);
   const existing=(await tx.query<any>('SELECT id FROM leave_files WHERE school_id=$1 AND leave_id=$2 AND archived=false',[p.schoolId,recordId])).rows;
   if(r.retainIds.some(fid=>!existing.some(x=>x.id===fid)))throw new ApiError('INVALID_ATTACHMENT','Attachment does not belong to this request.',422);
   const now=new Date().toISOString(),data={...(old?.data||{}),applicant:person.name,applicantType:r.applicantType,studentId:r.applicantType==='Student'?person.id:null,staffId:r.applicantType==='Staff'?person.id:null,type:r.type,from:r.from,to:r.to,reason:r.reason,priority:r.priority,status:'Pending',decisionNote:old?.data.decisionNote||'',submittedBy:old?.data.submittedBy||p.userId,submittedByName:old?.data.submittedByName||p.username,submittedAt:old?.data.submittedAt||now},contextData={leaveDuration:Math.round((Date.parse(r.to)-Date.parse(r.from))/86400000)+1,leaveType:r.type};if(editing)await authorizeUpdate(tx,p,leaveContext(p,{id:recordId,data:old.data}),leaveContext(p,{id:recordId,data}));else await authorizeCreate(tx,p,leaveContext(p,{id:recordId,data}));
   if(editing){await tx.query('UPDATE school_leave_requests SET data=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$2 AND id=$3',[JSON.stringify(data),p.schoolId,recordId]);instance.data.contextData=contextData;instance.data.title='Leave — '+person.name;await tx.query('UPDATE operation_workflow_instances SET data=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND school_id=$3',[JSON.stringify(instance.data),instance.id,p.schoolId]);}
   else{await startWorkflow(tx,p,'leave',recordId,'Leave — '+person.name,contextData);await tx.query('INSERT INTO school_leave_requests(id,school_id,data) VALUES($1,$2,$3)',[recordId,p.schoolId,JSON.stringify(data)]);}
   for(const f of existing)if(!r.retainIds.includes(f.id))await tx.query('UPDATE leave_files SET archived=true WHERE id=$1 AND school_id=$2',[f.id,p.schoolId]);
   for(const f of uploads)await tx.query('INSERT INTO leave_files(id,school_id,leave_id,name,type,size,content) VALUES($1,$2,$3,$4,$5,$6,$7)',[f.id,p.schoolId,recordId,f.name,f.type,f.size,f.content]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:editing?'LEAVE_UPDATED':'LEAVE_CREATED',entityType:'Leave',entityId:recordId,outcome:'SUCCESS',correlationId:req.correlationId});
  });return reply.code(editing?200:201).send({data:{id:recordId}});
 }});
 app.get('/api/v1/leave-files/:id',{preHandler:auth()},async req=>{const p=req.principal!;const f=(await db.query<any>('SELECT f.name,f.type,f.content,l.id AS leave_id,l.data FROM leave_files f JOIN school_leave_requests l ON l.id=f.leave_id AND l.school_id=f.school_id WHERE f.school_id=$1 AND f.id=$2 AND f.archived=false AND l.archived=false',[p.schoolId,String((req.params as any).id)])).rows[0];if(!f)throw new ApiError('NOT_FOUND','Attachment not found.',404);await authorizeRecord(db,p,'attachment.download',leaveContext(p,{id:f.leave_id,data:f.data}));return{data:{name:f.name,type:f.type,content:f.content}}});
}

