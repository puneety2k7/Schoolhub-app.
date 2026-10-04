import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {z} from 'zod';
import {authenticate} from '../auth/security.js';
import {requirePermission} from '../authorization/service.js';
import {requireSetupAdministration} from '../authorization/access-control.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
const printed=z.object({reportType:z.enum(['students','attendance','fees','academic','lowattendance']),filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean(),z.null()])).default({})}).strict();
export async function registerReportRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 app.get('/api/v1/reports/data',{preHandler:auth()},async req=>{const p=req.principal!;await requireSetupAdministration(db,p);requirePermission(p,'reports:view');const [students,attendance,payments,structures,assignments,exams,marks]=await Promise.all([
  db.query<any>(`SELECT s.id,s.admission_number AS admission,s.name,s.status,c.name AS class,se.name AS section,COALESCE(s.extra->>'gender','') AS gender FROM students s JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id LEFT JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id WHERE s.school_id=$1 ORDER BY s.name`,[p.schoolId]),
  db.query<any>(`SELECT a.id,a.attendance_date AS date,s.admission_number AS student,a.status,a.remark,a.version FROM attendance_records a JOIN students s ON s.id=a.student_id AND s.school_id=a.school_id WHERE a.school_id=$1 ORDER BY a.attendance_date,s.admission_number`,[p.schoolId]),
  db.query<any>('SELECT id,data,amount_minor,version FROM school_fee_payments WHERE school_id=$1 AND voided=false ORDER BY created_at,id',[p.schoolId]),
  db.query<any>('SELECT id,data,version FROM school_fee_structures WHERE school_id=$1 AND archived=false ORDER BY created_at,id',[p.schoolId]),
  db.query<any>(`SELECT a.student_id AS "studentId",a.structure_id AS "feeStructureId",s.admission_number AS student FROM school_fee_assignments a JOIN students s ON s.id=a.student_id AND s.school_id=a.school_id WHERE a.school_id=$1`,[p.schoolId]),
  db.query<any>(`SELECT e.id,e.name,c.name AS class,se.name AS section,sub.name AS subject,e.max_marks AS max,e.exam_date AS date,e.version FROM exam_records e JOIN classes c ON c.id=e.class_id AND c.school_id=e.school_id LEFT JOIN sections se ON se.id=e.section_id AND se.school_id=e.school_id LEFT JOIN subjects sub ON sub.id=e.subject_id AND sub.school_id=e.school_id WHERE e.school_id=$1 AND (e.state='Published' OR e.published=true) ORDER BY e.exam_date,e.name`,[p.schoolId]),
  db.query<any>(`SELECT m.id,m.exam_id AS "examId",s.admission_number AS student,m.marks,m.absent,m.version FROM mark_records m JOIN students s ON s.id=m.student_id AND s.school_id=m.school_id WHERE m.school_id=$1 ORDER BY m.exam_id,s.admission_number`,[p.schoolId])
 ]);const paymentItems=payments.rows.map(r=>({...r.data,id:r.id,version:r.version})),structureItems=structures.rows.map(r=>({...r.data,id:r.id,version:r.version})),data={students:students.rows,attendance:attendance.rows,fees:paymentItems,feeStructures:structureItems,feeAssignments:assignments.rows.map(r=>({...r,id:r.studentId+':'+r.feeStructureId})),exams:exams.rows.map(r=>({...r,max:Number(r.max)})),marks:marks.rows.map(r=>({...r,marks:r.marks===null?null:Number(r.marks)}))};const verifiedTotals={students:data.students.length,attendanceRecords:data.attendance.length,feePayments:data.fees.length,feeCollectedMinor:payments.rows.reduce((n,r)=>n+Number(r.amount_minor),0),feeStructures:data.feeStructures.length,publishedExams:data.exams.length,marks:data.marks.length};return{data:{...data,verifiedTotals,generatedAt:new Date().toISOString()}};});
 app.post('/api/v1/reports/printed',{preHandler:auth(true)},async req=>{const p=req.principal!;await requireSetupAdministration(db,p);requirePermission(p,'reports:print');const result=printed.safeParse(req.body);if(!result.success)throw new ApiError('VALIDATION_FAILED','Select a valid report type and filters.',422);await writeAudit(db,{schoolId:p.schoolId,actorUserId:p.userId,action:'GENERAL_REPORT_PRINTED',entityType:'Report',entityId:result.data.reportType,outcome:'SUCCESS',correlationId:req.correlationId,summary:result.data.filters});return{data:{recorded:true}};});
}
