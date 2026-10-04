import type {Queryable} from '../database/types.js';
import type {Principal} from '../authorization/service.js';
import {assertTeacherStudentScope} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
export async function examEnrollment(db:Queryable,p:Principal,s:any,yearId:string){
 const current=s.academicYearId??s.academic_year_id;
 if(current===yearId)return{classId:s.classId??s.class_id,sectionId:s.sectionId??s.section_id};
 const h=(await db.query<any>('SELECT class_id AS "classId",section_id AS "sectionId" FROM student_academic_history WHERE school_id=$1 AND student_id=$2 AND academic_year_id=$3',[p.schoolId,s.id,yearId])).rows[0];
 if(!h)throw new ApiError('ENROLLMENT_NOT_FOUND','No enrollment is recorded for this student in the selected academic year.',422);
 return h;
}
export async function examStudent(db:Queryable,p:Principal,id:string,yearId:string){
 const s=(await db.query<any>('SELECT id,name,admission_number AS "admissionNumber",academic_year_id AS "academicYearId",class_id AS "classId",section_id AS "sectionId",status FROM students WHERE school_id=$1 AND id=$2',[p.schoolId,id])).rows[0];
 if(!s)throw new ApiError('STUDENT_NOT_FOUND','Student not found.',404);
 const context=await examEnrollment(db,p,s,yearId);
 if(!!p.teacherId)await assertTeacherStudentScope(db,p,{class_id:context.classId,section_id:context.sectionId,academic_year_id:yearId});
 return {...s,...context};
}
export async function reportConfiguration(db:Queryable,schoolId:string){
 const row=(await db.query<any>('SELECT configuration,version FROM exam_report_configuration WHERE school_id=$1',[schoolId])).rows[0];
 return row||{configuration:null,version:0};
}
export async function coScholasticRows(db:Queryable,schoolId:string,studentId:string,yearId:string){
 return(await db.query<any>('SELECT skill_id AS "skillId",skill_name AS "skillName",rating,version FROM co_scholastic_evaluations WHERE school_id=$1 AND student_id=$2 AND academic_year_id=$3 ORDER BY skill_name',[schoolId,studentId,yearId])).rows;
}

