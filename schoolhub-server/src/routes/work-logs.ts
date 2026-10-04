import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Queryable} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission,assertTeacherStudentScope,type Principal} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
const id=z.string().min(1).max(120),recordSchema=z.object({teacherId:id,class:id,section:id,academicYear:id,date:z.string().date(),subject:z.string().trim().min(1).max(200),period:z.string().trim().min(1).max(80),topic:z.string().trim().min(1).max(500),details:z.string().max(20000),homeworkGiven:z.string().max(10000),remarks:z.string().max(10000)}).strict();
const fileSchema=z.object({name:z.string().min(1).max(240),content:z.string().max(14*1024*1024)}).strict();
const saveSchema=z.object({record:recordSchema,retainIds:z.array(id).max(5),newFiles:z.array(fileSchema).max(5),version:z.number().int().nonnegative()}).strict();
function parse<T>(s:z.ZodType<T>,v:unknown):T{const r=s.safeParse(v);if(!r.success)throw new ApiError('VALIDATION_FAILED','Check work log fields and attachments.',422);return r.data;}
function own(p:Principal,teacherId:string){if(!!p.teacherId&&p.teacherId!==teacherId)throw new ApiError('FORBIDDEN','You can access only your own teaching logs.',403);}
const types:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',txt:'text/plain',csv:'text/csv',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export function validateAttachmentFile(input:z.infer<typeof fileSchema>){
 const ext=input.name.split('.').pop()?.toLowerCase()||'',type=types[ext];if(!type||/[\\/\x00-\x1f]/.test(input.name)||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.content))throw new ApiError('VALIDATION_FAILED','Unsupported attachment file.',422);
 const bytes=Buffer.from(input.content,'base64');if(bytes.length>10*1024*1024||bytes.toString('base64')!==input.content)throw new ApiError('VALIDATION_FAILED','Each attachment must be valid and no larger than 10 MB.',422);
 if(ext==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')throw new ApiError('VALIDATION_FAILED','Invalid PDF attachment.',422);
 if((ext==='jpg'||ext==='jpeg')&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw new ApiError('VALIDATION_FAILED','Invalid JPEG attachment.',422);
 if(ext==='png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new ApiError('VALIDATION_FAILED','Invalid PNG attachment.',422);
 if(ext==='webp'&&!(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'))throw new ApiError('VALIDATION_FAILED','Invalid WebP attachment.',422);
 return {...input,id:randomUUID(),type,size:bytes.length};
}
async function row(tx:Queryable,p:Principal,id:string){const r=(await tx.query<any>('SELECT * FROM teacher_work_logs WHERE id=$1 AND school_id=$2 AND archived=false FOR UPDATE',[id,p.schoolId])).rows[0];if(!r)throw new ApiError('NOT_FOUND','Work log not found.',404);own(p,r.teacher_id);return r;}
export async function registerWorkLogRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 app.get('/api/v1/work-logs',{preHandler:auth()},async req=>{
  const p=req.principal!;requirePermission(p,'teacherlog:view');if(!!p.teacherId&&!p.teacherId)throw new ApiError('FORBIDDEN','Your account needs a staff link.',403);
  const logs=(await db.query<any>('SELECT w.*,u.username AS creator,v.username AS updater FROM teacher_work_logs w JOIN users u ON u.id=w.created_by JOIN users v ON v.id=w.updated_by WHERE w.school_id=$1 AND w.archived=false'+(!!p.teacherId?' AND w.teacher_id=$2':'')+' ORDER BY w.created_at DESC',!!p.teacherId?[p.schoolId,p.teacherId]:[p.schoolId])).rows;
  const files=(await db.query<any>('SELECT f.id,f.work_log_id,f.name,f.type,f.size FROM teacher_work_log_files f JOIN teacher_work_logs w ON w.id=f.work_log_id AND w.school_id=f.school_id WHERE f.school_id=$1 AND f.archived=false AND w.archived=false'+(!!p.teacherId?' AND w.teacher_id=$2':''),!!p.teacherId?[p.schoolId,p.teacherId]:[p.schoolId])).rows;
  const staff=(await db.query('SELECT id,name FROM staff WHERE school_id=$1 AND status=$2'+(!!p.teacherId?' AND id=$3':''),!!p.teacherId?[p.schoolId,'Active',p.teacherId]:[p.schoolId,'Active'])).rows;
  const classes=(await db.query('SELECT id,name FROM classes WHERE school_id=$1 AND active=true ORDER BY name',[p.schoolId])).rows,sections=(await db.query('SELECT id,class_id AS "classId",name FROM sections WHERE school_id=$1 AND active=true',[p.schoolId])).rows,years=(await db.query('SELECT id,name,active FROM academic_years WHERE school_id=$1 ORDER BY active DESC,created_at DESC',[p.schoolId])).rows;
  const timetable=(await db.query('SELECT t.class_id AS "classId",t.section_id AS "sectionId",t.academic_year_id AS "academicYearId",t.teacher_id AS "teacherId",t.day_of_week AS day,COALESCE(sp.name,t.period_key) AS period,t.period_key AS "periodKey",s.name AS subject FROM timetable_entries t LEFT JOIN subjects s ON s.id=t.subject_id AND s.school_id=t.school_id LEFT JOIN school_periods sp ON sp.id=t.period_key AND sp.school_id=t.school_id WHERE t.school_id=$1 AND t.active=true'+(!!p.teacherId?' AND t.teacher_id=$2':''),!!p.teacherId?[p.schoolId,p.teacherId]:[p.schoolId])).rows;
  return {data:{items:logs.map(r=>({...r.data,id:r.id,version:r.version,teacherId:r.teacher_id,classId:r.class_id,sectionId:r.section_id,academicYearId:r.academic_year_id,createdByUserId:r.created_by,createdBy:r.creator,createdByUsername:r.creator,updatedBy:r.updater,createdAt:r.created_at,updatedAt:r.updated_at,attachments:files.filter(f=>f.work_log_id===r.id).map(({work_log_id,...f})=>f)})),staff,classes,sections,years,timetable}};
 });
 for(const method of ['POST','PATCH'] as const)app.route({method,url:'/api/v1/work-logs'+(method==='PATCH'?'/:id':''),bodyLimit:72*1024*1024,preHandler:auth(true),handler:async(req,reply)=>{
  const p=req.principal!,editing=method==='PATCH';requirePermission(p,editing?'teacherlog:update':'teacherlog:create');const input=parse(saveSchema,req.body),id=editing?String((req.params as any).id):randomUUID();own(p,input.record.teacherId);
  if(new Set(input.retainIds).size!==input.retainIds.length||input.retainIds.length+input.newFiles.length>5||(!editing&&input.retainIds.length))throw new ApiError('VALIDATION_FAILED','Maximum five valid attachments per work log.',422);
  const files=input.newFiles.map(validateAttachmentFile);
  await db.transaction(async tx=>{
   const old=editing?await row(tx,p,id):null;if((old?.version||0)!==input.version)throw new ApiError('RECORD_VERSION_CONFLICT','This work log changed. Refresh before editing.',409);
   if(old?.log_date)throw new ApiError('WORK_LOG_EDITOR_REQUIRED','Use the current Work Log editor to preserve timetable context.',409);
   const teacher=(await tx.query<any>('SELECT id,name FROM staff WHERE school_id=$1 AND id=$2 AND status=$3',[p.schoolId,input.record.teacherId,'Active'])).rows[0];
   const cls=(await tx.query<any>('SELECT id FROM classes WHERE school_id=$1 AND name=$2 AND active=true',[p.schoolId,input.record.class])).rows[0];
   const section=cls?(await tx.query<any>('SELECT id FROM sections WHERE school_id=$1 AND class_id=$2 AND name=$3 AND active=true',[p.schoolId,cls.id,input.record.section])).rows[0]:null;
   const year=(await tx.query<any>('SELECT id FROM academic_years WHERE school_id=$1 AND name=$2',[p.schoolId,input.record.academicYear])).rows[0];
   if(!teacher||!cls||!section||!year)throw new ApiError('VALIDATION_FAILED','Select valid school teacher, class, section and academic year.',422);
   await assertTeacherStudentScope(tx,p,{class_id:cls.id,section_id:section.id,academic_year_id:year.id});
   const existing=(await tx.query<any>('SELECT id FROM teacher_work_log_files WHERE school_id=$1 AND work_log_id=$2 AND archived=false',[p.schoolId,id])).rows;
   if(input.retainIds.some(id=>!existing.some(f=>f.id===id)))throw new ApiError('VALIDATION_FAILED','Attachment does not belong to this work log.',422);
   const data={...input.record,teacherName:teacher.name,className:input.record.class,sectionName:input.record.section,subjectName:input.record.subject};
   if(editing)await tx.query('UPDATE teacher_work_logs SET teacher_id=$1,class_id=$2,section_id=$3,academic_year_id=$4,data=$5,updated_by=$6,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=$7 AND school_id=$8',[teacher.id,cls.id,section.id,year.id,JSON.stringify(data),p.userId,id,p.schoolId]);
   else await tx.query('INSERT INTO teacher_work_logs(id,school_id,teacher_id,class_id,section_id,academic_year_id,data,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',[id,p.schoolId,teacher.id,cls.id,section.id,year.id,JSON.stringify(data),p.userId]);
   for(const f of existing)if(!input.retainIds.includes(f.id))await tx.query('UPDATE teacher_work_log_files SET archived=true WHERE id=$1 AND school_id=$2',[f.id,p.schoolId]);
   for(const f of files)await tx.query('INSERT INTO teacher_work_log_files(id,school_id,work_log_id,name,type,size,content) VALUES($1,$2,$3,$4,$5,$6,$7)',[f.id,p.schoolId,id,f.name,f.type,f.size,f.content]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:editing?'WORK_LOG_UPDATED':'WORK_LOG_CREATED',entityType:'Teacher Work Log',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});
  });return reply.code(editing?200:201).send({data:{id}});
 }});
 app.post('/api/v1/work-logs/:id/remove',{preHandler:auth(true)},async req=>{const p=req.principal!,id=String((req.params as any).id);requirePermission(p,'teacherlog:delete');const {version}=parse(z.object({version:z.number().int().positive()}).strict(),req.body);await db.transaction(async tx=>{const old=await row(tx,p,id);if(old.version!==version)throw new ApiError('RECORD_VERSION_CONFLICT','Work log changed. Refresh before deleting.',409);await tx.query('UPDATE teacher_work_logs SET archived=true,version=version+1,updated_at=CURRENT_TIMESTAMP,updated_by=$1 WHERE id=$2 AND school_id=$3',[p.userId,id,p.schoolId]);await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'WORK_LOG_REMOVED',entityType:'Teacher Work Log',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});});return {data:{removed:true}};});
 app.get('/api/v1/work-log-files/:id',{preHandler:auth()},async req=>{const p=req.principal!;requirePermission(p,'teacherlog:view');const f=(await db.query<any>('SELECT f.name,f.type,f.content,w.teacher_id FROM teacher_work_log_files f JOIN teacher_work_logs w ON w.id=f.work_log_id AND w.school_id=f.school_id WHERE f.id=$1 AND f.school_id=$2 AND f.archived=false AND w.archived=false',[String((req.params as any).id),p.schoolId])).rows[0];if(!f)throw new ApiError('NOT_FOUND','Attachment not found.',404);own(p,f.teacher_id);return {data:{name:f.name,type:f.type,content:f.content}};});
}
