import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from '../database/types.js';
import type { Principal } from '../authorization/service.js';
import { assertTeacherStudentScope, requirePermission } from '../authorization/service.js';
import { ApiError } from '../errors/api-error.js';
import type {PortalModuleKey} from './portal-configuration.js';

function row<T>(result:{rows:T[]}):T|undefined{return result.rows[0]}
async function activeStudent(db:Queryable,p:Principal,id:string){
 const found=await db.query<any>('SELECT id,admission_number AS "admissionNumber",name,class_id AS "classId",section_id AS "sectionId",academic_year_id AS "academicYearId",status,version FROM students WHERE id=$1 AND school_id=$2 AND status=$3',[id,p.schoolId,'Active']);
 if(!found.rows[0])throw new ApiError('STUDENT_NOT_FOUND','Student not found.',404);
 return found.rows[0]
}
export class PortalService{
 constructor(private db:Database){}
 private async studentBundle(p:Principal,id:string,modules:Record<PortalModuleKey,boolean>){
  const student=await activeStudent(this.db,p,id);
  const attendance=modules.attendance?await this.db.query<any>('SELECT id,attendance_date AS "date",period,status,remark,version FROM attendance_records WHERE school_id=$1 AND student_id=$2 ORDER BY attendance_date DESC LIMIT 120',[p.schoolId,id]):{rows:[]};
  const homework=modules.homework?await this.db.query<any>("SELECT h.id,h.title,h.instructions,h.assigned_date AS \"assignedDate\",h.due_date AS \"dueDate\",h.status,s.name AS subject FROM homework_records h LEFT JOIN subjects s ON s.id=h.subject_id WHERE h.school_id=$1 AND h.class_id=$2 AND (h.section_id IS NULL OR h.section_id=$3) AND (h.academic_year_id IS NULL OR h.academic_year_id=$4) AND h.status='Published' ORDER BY h.assigned_date DESC LIMIT 100",[p.schoolId,student.classId,student.sectionId,student.academicYearId]):{rows:[]};
  const results=modules.results?await this.db.query<any>('SELECT e.id AS "examId",e.name,s.name AS subject,e.max_marks AS "maxMarks",m.marks,m.absent,m.version FROM mark_records m JOIN exam_records e ON e.id=m.exam_id LEFT JOIN subjects s ON s.id=e.subject_id WHERE m.school_id=$1 AND m.student_id=$2 AND e.published=true ORDER BY e.name,s.name',[p.schoolId,id]):{rows:[]};
  const fees=modules.fees?await this.db.query<any>('SELECT id,total_due AS "totalDue",total_paid AS "totalPaid",status,academic_year_id AS "academicYearId",version FROM fee_summaries WHERE school_id=$1 AND student_id=$2 ORDER BY updated_at DESC',[p.schoolId,id]):{rows:[]};
  return{student,attendance:attendance.rows,homework:homework.rows,results:results.rows,fees:fees.rows}
 }
 async dashboard(p:Principal,modules:Record<PortalModuleKey,boolean>){
  if(p.studentId){
   if(!p.studentId)throw new ApiError('STUDENT_NOT_LINKED','This account is not linked to a student profile.',403);
   return{portal:'Student',readOnly:true,profiles:[await this.studentBundle(p,p.studentId,modules)]}
  }
  if(p.guardianId){
   if(!p.guardianId)throw new ApiError('PARENT_NOT_LINKED','This account is not linked to a guardian profile.',403);
   const linked=await this.db.query<{studentId:string}>('SELECT student_id AS "studentId" FROM guardian_student_links WHERE school_id=$1 AND guardian_id=$2 AND active=true ORDER BY student_id',[p.schoolId,p.guardianId]);
   return{portal:'Parent',readOnly:true,profiles:await Promise.all(linked.rows.map(x=>this.studentBundle(p,x.studentId,modules)))}
  }
  if(p.teacherId){
   if(!p.teacherId)throw new ApiError('TEACHER_NOT_LINKED','This teacher account is not linked to a staff record.',403);
   const assignments=await this.db.query<any>("SELECT a.id,a.class_id AS \"classId\",a.section_id AS \"sectionId\",a.subject_id AS \"subjectId\",a.academic_year_id AS \"academicYearId\",a.assignment_type AS \"assignmentType\",c.name AS class,se.name AS section,su.name AS subject FROM teacher_assignments a JOIN classes c ON c.id=a.class_id LEFT JOIN sections se ON se.id=a.section_id LEFT JOIN subjects su ON su.id=a.subject_id WHERE a.school_id=$1 AND a.teacher_id=$2 AND a.active=true AND (a.valid_from IS NULL OR a.valid_from<=CURRENT_DATE) AND (a.valid_until IS NULL OR a.valid_until>=CURRENT_DATE) ORDER BY c.name,se.sort_order,su.name",[p.schoolId,p.teacherId]);
   const students=await this.db.query<any>("SELECT DISTINCT s.id,s.admission_number AS \"admissionNumber\",s.name,s.class_id AS \"classId\",s.section_id AS \"sectionId\",s.academic_year_id AS \"academicYearId\",s.version FROM students s JOIN teacher_assignments a ON a.school_id=s.school_id AND a.class_id=s.class_id AND (a.section_id IS NULL OR a.section_id=s.section_id) AND (a.academic_year_id IS NULL OR s.academic_year_id IS NULL OR a.academic_year_id=s.academic_year_id) WHERE s.school_id=$1 AND a.teacher_id=$2 AND a.active=true AND s.status='Active' AND (a.valid_from IS NULL OR a.valid_from<=CURRENT_DATE) AND (a.valid_until IS NULL OR a.valid_until>=CURRENT_DATE) ORDER BY s.name LIMIT 500",[p.schoolId,p.teacherId]);
   const homework=await this.db.query<any>('SELECT id,title,assigned_date AS "assignedDate",due_date AS "dueDate",status,class_id AS "classId",section_id AS "sectionId",subject_id AS "subjectId",version FROM homework_records WHERE school_id=$1 AND teacher_id=$2 ORDER BY assigned_date DESC LIMIT 100',[p.schoolId,p.teacherId]);
   const exams=await this.db.query<any>("SELECT DISTINCT e.id,e.name,e.max_marks AS \"maxMarks\",e.class_id AS \"classId\",e.section_id AS \"sectionId\",e.subject_id AS \"subjectId\",e.academic_year_id AS \"academicYearId\",e.published,e.version FROM exam_records e JOIN teacher_assignments a ON a.school_id=e.school_id AND a.class_id=e.class_id AND (a.section_id IS NULL OR a.section_id=e.section_id) AND (a.subject_id IS NULL OR a.subject_id=e.subject_id) WHERE e.school_id=$1 AND a.teacher_id=$2 AND a.active=true ORDER BY e.name",[p.schoolId,p.teacherId]);
   return{portal:'Teacher',readOnly:false,assignments:assignments.rows,students:students.rows,homework:homework.rows,exams:exams.rows}
  }
  requirePermission(p,'portal:admin');
  const counts=await Promise.all(['students','staff','guardian_profiles','attendance_records','homework_records','exam_records'].map(async table=>Number(row(await this.db.query<{count:string}>('SELECT count(*)::text count FROM '+table+' WHERE school_id=$1',[p.schoolId]))?.count||0)));
  return{portal:'Administrator',readOnly:true,counts:{students:counts[0],staff:counts[1],guardians:counts[2],attendance:counts[3],homework:counts[4],exams:counts[5]}}
 }
 async createGuardian(p:Principal,input:{name:string;email?:string|null;phone?:string|null}){
  requirePermission(p,'portal:manage');const id=randomUUID();
  const result=await this.db.query<any>('INSERT INTO guardian_profiles(id,school_id,name,email,phone) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,phone,status,version',[id,p.schoolId,input.name,input.email||null,input.phone||null]);
  return result.rows[0]
 }
 async linkUserStudent(tx:Queryable,p:Principal,userId:string,studentId:string|null,version:number){
  requirePermission(p,'portal:manage');if(studentId)await activeStudent(tx as any,p,studentId);
  const result=await tx.query<any>('UPDATE users SET student_id=$1,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=$2 AND school_id=$3 AND version=$4 RETURNING id,student_id AS "studentId",version',[studentId,userId,p.schoolId,version]);
  if(!result.rows[0])throw new ApiError('RECORD_VERSION_CONFLICT','The user changed. Refresh and try again.',409);return result.rows[0]
 }
 async linkUserGuardian(tx:Queryable,p:Principal,userId:string,guardianId:string|null){
  requirePermission(p,'portal:manage');
  const user=await tx.query('SELECT id FROM users WHERE id=$1 AND school_id=$2',[userId,p.schoolId]);if(!user.rows[0])throw new ApiError('USER_NOT_FOUND','User not found.',404);
  await tx.query('DELETE FROM user_guardian_links WHERE user_id=$1 AND school_id=$2',[userId,p.schoolId]);
  if(guardianId){const guardian=await tx.query('SELECT id FROM guardian_profiles WHERE id=$1 AND school_id=$2 AND status=$3',[guardianId,p.schoolId,'Active']);if(!guardian.rows[0])throw new ApiError('GUARDIAN_NOT_FOUND','Guardian not found.',404);await tx.query('INSERT INTO user_guardian_links(user_id,guardian_id,school_id) VALUES($1,$2,$3)',[userId,guardianId,p.schoolId])}
  return{userId,guardianId}
 }
 async linkGuardianStudent(p:Principal,guardianId:string,studentId:string,relationship:string){
  requirePermission(p,'portal:manage');await activeStudent(this.db,p,studentId);
  const guardian=await this.db.query('SELECT id FROM guardian_profiles WHERE id=$1 AND school_id=$2 AND status=$3',[guardianId,p.schoolId,'Active']);if(!guardian.rows[0])throw new ApiError('GUARDIAN_NOT_FOUND','Guardian not found.',404);
  const id=randomUUID(),result=await this.db.query<any>('INSERT INTO guardian_student_links(id,school_id,guardian_id,student_id,relationship,active) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(school_id,guardian_id,student_id) DO UPDATE SET relationship=EXCLUDED.relationship,active=true RETURNING id,guardian_id AS "guardianId",student_id AS "studentId",relationship,active',[id,p.schoolId,guardianId,studentId,relationship]);
  return result.rows[0]
 }
 async saveAttendance(tx:Queryable,p:Principal,input:{date:string;period:string;rows:Array<{studentId:string;status:string;remark?:string}>}){
  requirePermission(p,'attendance:manage');
  for(const item of input.rows){const student=await activeStudent(tx as any,p,item.studentId);await assertTeacherStudentScope(tx,p,{class_id:student.classId,section_id:student.sectionId,academic_year_id:student.academicYearId},true)}
  const saved=[];for(const item of input.rows){const id=randomUUID();const result=await tx.query<any>('INSERT INTO attendance_records(id,school_id,student_id,attendance_date,period,status,remark,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(school_id,student_id,attendance_date,period) DO UPDATE SET status=EXCLUDED.status,remark=EXCLUDED.remark,recorded_by=EXCLUDED.recorded_by,updated_at=CURRENT_TIMESTAMP,version=attendance_records.version+1 RETURNING id,student_id AS "studentId",status,version',[id,p.schoolId,item.studentId,input.date,input.period,item.status,item.remark||null,p.userId]);saved.push(result.rows[0])}return saved
 }
 private async assertTeaching(p:Principal,input:{classId:string;sectionId?:string|null;subjectId?:string|null;academicYearId?:string|null}){
  if(!p.teacherId)return;
  const found=await this.db.query("SELECT id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$2 AND active=true AND class_id=$3 AND (section_id IS NULL OR section_id=$4) AND (subject_id IS NULL OR subject_id=$5) AND (academic_year_id IS NULL OR academic_year_id=$6) AND (valid_from IS NULL OR valid_from<=CURRENT_DATE) AND (valid_until IS NULL OR valid_until>=CURRENT_DATE)",[p.schoolId,p.teacherId,input.classId,input.sectionId||null,input.subjectId||null,input.academicYearId||null]);
  if(!found.rows[0])throw new ApiError('TEACHING_ASSIGNMENT_REQUIRED','This class, section, or subject is outside your active assignment.',403)
 }
 async createHomework(p:Principal,input:{classId:string;sectionId?:string|null;subjectId?:string|null;academicYearId?:string|null;title:string;instructions:string;assignedDate:string;dueDate?:string|null}){
  requirePermission(p,'homework:manage');await this.assertTeaching(p,input);const id=randomUUID();
  const result=await this.db.query<any>('INSERT INTO homework_records(id,school_id,academic_year_id,class_id,section_id,subject_id,teacher_id,title,instructions,assigned_date,due_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,title,instructions,assigned_date AS "assignedDate",due_date AS "dueDate",status,version',[id,p.schoolId,input.academicYearId||null,input.classId,input.sectionId||null,input.subjectId||null,p.teacherId,input.title,input.instructions,input.assignedDate,input.dueDate||null,'Published']);return result.rows[0]
 }
 async saveMark(tx:Queryable,p:Principal,input:{examId:string;studentId:string;marks?:number|null;absent:boolean;version?:number}){
  requirePermission(p,'marks:manage');
  const exam=await tx.query<any>('SELECT id,class_id AS "classId",section_id AS "sectionId",subject_id AS "subjectId",academic_year_id AS "academicYearId",max_marks AS "maxMarks",published FROM exam_records WHERE id=$1 AND school_id=$2',[input.examId,p.schoolId]);const e=exam.rows[0];if(!e)throw new ApiError('EXAM_NOT_FOUND','Exam not found.',404);if(e.published)throw new ApiError('RESULTS_PUBLISHED','Published results cannot be changed.',409);
  const student=await activeStudent(tx as any,p,input.studentId);await assertTeacherStudentScope(tx,p,{class_id:student.classId,section_id:student.sectionId,academic_year_id:student.academicYearId},true);await this.assertTeaching(p,e);
  if(!input.absent&&(input.marks==null||input.marks<0||input.marks>Number(e.maxMarks)))throw new ApiError('MARKS_OUT_OF_RANGE','Marks must be within the exam maximum.',422);
  const id=randomUUID(),result=await tx.query<any>('INSERT INTO mark_records(id,school_id,exam_id,student_id,marks,absent,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(school_id,exam_id,student_id) DO UPDATE SET marks=EXCLUDED.marks,absent=EXCLUDED.absent,recorded_by=EXCLUDED.recorded_by,updated_at=CURRENT_TIMESTAMP,version=mark_records.version+1 RETURNING id,exam_id AS "examId",student_id AS "studentId",marks,absent,version',[id,p.schoolId,input.examId,input.studentId,input.absent?null:input.marks,input.absent,p.userId]);return result.rows[0]
 }
}

