import {authorizeArchivedLifecycle} from '../authorization/policy-engine.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {AcademicService} from '../services/academic-service.js';
import {WorkspaceService} from '../services/workspace-service.js';
import {examEnrollment,examStudent,reportConfiguration,coScholasticRows} from '../services/exam-context.js';
const id=z.string().min(1).max(120),version=z.number().int().nonnegative();
const evaluation=z.object({studentId:id,academicYearId:id,rows:z.array(z.object({skillId:id,rating:z.string().trim().max(80),version}).strict()).max(100)}).strict();
function parse<T>(schema:z.ZodType<T>,data:unknown){const p=schema.safeParse(data);if(!p.success)throw new ApiError('VALIDATION_FAILED','Check the selected fields.',422);return p.data}
export async function registerExamWorkspaceRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write),service=new AcademicService(db);
 const view=(p:any)=>{if(!p.teacherId)requirePermission(p,'exams:view')};
 const audit=(tx:any,req:any,action:string,entityId?:string)=>writeAudit(tx,{schoolId:req.principal.schoolId,actorUserId:req.principal.userId,action,entityType:'Exam Result',entityId,outcome:'SUCCESS',correlationId:req.correlationId});
 app.get('/api/v1/exam-workspace/options',{preHandler:auth()},async req=>{
  const p=req.principal!;view(p);const refs:any={};for(const [key,table]of Object.entries({years:'academic_years',classes:'classes',sections:'sections',subjects:'subjects'}))refs[key]=(await db.query('SELECT id,name,active'+(table==='sections'?',class_id AS "classId"':'')+' FROM '+table+' WHERE school_id=$1 ORDER BY name',[p.schoolId])).rows;
  const wm=new WorkspaceService(db);await wm.syncFactories(p,'exam-workspace');const w=(await db.query<any>("SELECT id FROM workspace_definitions WHERE school_id=$1 AND workspace_key='exams-results'",[p.schoolId])).rows[0];const definition=await wm.definition(db,p,w.id),has=(permission:string)=>p.systemRecovery===true||p.permissions.includes(permission);
  return{data:{refs,definition,configuration:await reportConfiguration(db,p.schoolId),permissions:{manage:has('exams:manage'),marks:has('marks:manage'),publish:has('marks:publish'),correct:has('marks:correct'),report:has('reportcards:view'),publishReport:has('reportcards:publish'),configure:has('school:manage'),restore:has('school:manage')&&has('exams:manage')}}};
 });
 app.get('/api/v1/exam-workspace/students',{preHandler:auth()},async req=>{
  const p=req.principal!;view(p);const q=parse(z.object({academicYearId:id,classId:id,sectionId:id.optional()}).strict(),req.query);
  const students=(await db.query<any>('SELECT id,name,admission_number AS "admissionNumber",class_id AS "classId",section_id AS "sectionId",academic_year_id AS "academicYearId",status FROM students WHERE school_id=$1 ORDER BY name',[p.schoolId])).rows;
  const rows=[];for(const s of students){let e;try{e=await examEnrollment(db,p,s,q.academicYearId)}catch{continue}if(e.classId!==q.classId||(q.sectionId&&e.sectionId!==q.sectionId))continue;if(s.academicYearId===q.academicYearId&&s.status!=='Active')continue;if(!!p.teacherId){try{await examStudent(db,p,s.id,q.academicYearId)}catch{continue}}rows.push({...s,...e})}return{data:{items:rows}};
 });
 app.get('/api/v1/exam-workspace/:id/marks',{preHandler:auth()},async req=>{
  const p=req.principal!;view(p);const examId=String((req.params as any).id),exams=await service.exams(p,{}),exam=exams.items.find(x=>x.id===examId);if(!exam)throw new ApiError('EXAM_NOT_FOUND','Assessment not found or unavailable to this account.',404);
  const students=(await db.query<any>('SELECT id,name,admission_number AS "admissionNumber",class_id AS "classId",section_id AS "sectionId",academic_year_id AS "academicYearId",status FROM students WHERE school_id=$1 ORDER BY name',[p.schoolId])).rows,marks=(await db.query<any>('SELECT student_id AS "studentId",marks,absent,version FROM mark_records WHERE school_id=$1 AND exam_id=$2',[p.schoolId,examId])).rows,items=[];
  for(const s of students){let enrollment;try{enrollment=await examEnrollment(db,p,s,exam.academicYearId)}catch{continue}if(enrollment.classId!==exam.classId||(exam.sectionId&&enrollment.sectionId!==exam.sectionId))continue;const mark=marks.find(m=>m.studentId===s.id);if(s.status!=='Active'&&!mark)continue;items.push({id:s.id,name:s.name,admissionNumber:s.admissionNumber,marks:mark?.marks==null?null:Number(mark.marks),absent:mark?.absent||false,version:mark?.version,recorded:!!mark})}return{data:{exam,items}};
 });
 app.post('/api/v1/exam-workspace/:id/restore',{preHandler:auth(true)},async req=>{
  const p=req.principal!;const input=parse(z.object({version}).strict(),req.body),examId=String((req.params as any).id);
  return{data:await db.transaction(async tx=>{const old=(await tx.query<any>('SELECT * FROM exam_records WHERE school_id=$1 AND id=$2 FOR UPDATE',[p.schoolId,examId])).rows[0];if(!old)throw new ApiError('RECORD_NOT_FOUND','Assessment not found.',404);await authorizeArchivedLifecycle(tx,p,'record.restore',{schoolId:p.schoolId,workspaceKey:'exams-results',resourceType:'exam',recordId:examId,classId:old.class_id,sectionId:old.section_id,subjectId:old.subject_id,academicYearId:old.academic_year_id,lifecycle:old.state});const r=await tx.query<any>("UPDATE exam_records SET state=COALESCE(archived_from_state,'Draft'),archived_from_state=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$1 AND id=$2 AND state='Archived' AND version=$3 RETURNING id,state,version",[p.schoolId,examId,input.version]);if(!r.rows[0])throw new ApiError('RECORD_VERSION_CONFLICT','Refresh before restoring this assessment.',409);await audit(tx,req,'EXAM_RESTORED',examId);return r.rows[0]})};
 });
 app.get('/api/v1/exam-workspace/report-configuration',{preHandler:auth()},async req=>{view(req.principal!);return{data:await reportConfiguration(db,req.principal!.schoolId)}});
 app.put('/api/v1/exam-workspace/report-configuration',{preHandler:auth(true)},async req=>{
  const p=req.principal!;requirePermission(p,'school:manage');const input=parse(z.object({version,configuration:z.record(z.string(),z.unknown())}).strict(),req.body),c:any=input.configuration;
  if(JSON.stringify(c).length>100000)throw new ApiError('VALIDATION_FAILED','Report configuration is too large.',422);
  const skills=parse(z.array(z.object({id,name:z.string().trim().min(1).max(180),enabled:z.boolean().optional()}).passthrough()).max(100),c.coScholasticSkills||[]);if(new Set(skills.map(s=>s.id)).size!==skills.length)throw new ApiError('VALIDATION_FAILED','Skill identifiers must be unique.',422);
  if(c.design?.primaryColor&&!/^#[0-9a-f]{3,8}$/i.test(c.design.primaryColor))throw new ApiError('VALIDATION_FAILED','Invalid report accent color.',422);
  return{data:await db.transaction(async tx=>{await tx.query('SELECT id FROM schools WHERE id=$1 FOR UPDATE',[p.schoolId]);const old=await reportConfiguration(tx,p.schoolId);if(old.version!==input.version)throw new ApiError('RECORD_VERSION_CONFLICT','Report settings changed. Reload before saving.',409);if(old.version)await tx.query('UPDATE exam_report_configuration SET configuration=$1,version=version+1,updated_by=$2,updated_at=CURRENT_TIMESTAMP WHERE school_id=$3',[JSON.stringify(c),p.userId,p.schoolId]);else await tx.query('INSERT INTO exam_report_configuration(school_id,configuration,updated_by) VALUES($1,$2,$3)',[p.schoolId,JSON.stringify(c),p.userId]);await audit(tx,req,'REPORT_DESIGNER_SAVED');return reportConfiguration(tx,p.schoolId)})};
 });
 app.get('/api/v1/exam-workspace/co-scholastic',{preHandler:auth()},async req=>{
  const p=req.principal!;view(p);const q=parse(z.object({studentId:id,academicYearId:id}).strict(),req.query);await examStudent(db,p,q.studentId,q.academicYearId);const c=await reportConfiguration(db,p.schoolId),locked=(await db.query('SELECT id FROM report_card_snapshots WHERE school_id=$1 AND student_id=$2 AND academic_year_id=$3',[p.schoolId,q.studentId,q.academicYearId])).rows.length>0;return{data:{skills:(c.configuration?.coScholasticSkills||[]).filter((s:any)=>s.enabled!==false),items:await coScholasticRows(db,p.schoolId,q.studentId,q.academicYearId),locked}};
 });
 app.put('/api/v1/exam-workspace/co-scholastic',{preHandler:auth(true)},async req=>{
  const p=req.principal!;if(!p.teacherId)requirePermission(p,'marks:manage');const input=parse(evaluation,req.body);
  return{data:await db.transaction(async tx=>{await examStudent(tx,p,input.studentId,input.academicYearId);await tx.query('SELECT id FROM students WHERE id=$1 AND school_id=$2 FOR UPDATE',[input.studentId,p.schoolId]);if((await tx.query('SELECT id FROM report_card_snapshots WHERE school_id=$1 AND student_id=$2 AND academic_year_id=$3',[p.schoolId,input.studentId,input.academicYearId])).rows.length)throw new ApiError('REPORT_PUBLISHED','This report card is published; its evaluations are locked.',409);const c=await reportConfiguration(tx,p.schoolId),skills=(c.configuration?.coScholasticSkills||[]).filter((s:any)=>s.enabled!==false),old=await coScholasticRows(tx,p.schoolId,input.studentId,input.academicYearId);if(new Set(input.rows.map(x=>x.skillId)).size!==input.rows.length)throw new ApiError('VALIDATION_FAILED','Duplicate skill.',422);for(const item of input.rows){const skill=skills.find((s:any)=>s.id===item.skillId);if(!skill)throw new ApiError('INVALID_SKILL','Select a skill from Report Card Designer.',422);const previous=old.find(r=>r.skillId===item.skillId);if((previous?.version||0)!==item.version)throw new ApiError('RECORD_VERSION_CONFLICT','An evaluation changed. Reload before saving.',409);if(previous)await tx.query('UPDATE co_scholastic_evaluations SET rating=$1,skill_name=$2,version=version+1,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE school_id=$4 AND student_id=$5 AND academic_year_id=$6 AND skill_id=$7',[item.rating,skill.name,p.userId,p.schoolId,input.studentId,input.academicYearId,item.skillId]);else if(item.rating)await tx.query('INSERT INTO co_scholastic_evaluations(id,school_id,student_id,academic_year_id,skill_id,skill_name,rating,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),p.schoolId,input.studentId,input.academicYearId,item.skillId,skill.name,item.rating,p.userId])}await audit(tx,req,'CO_SCHOLASTIC_SAVED',input.studentId);return{saved:true}})};
 });
}

