import type { Queryable } from '../database/types.js';
import { deny } from '../errors/api-error.js';
import { permissionContract } from './policy-registry.js';
export type Principal={userId:string;schoolId:string;roleId:string;roleName:string;systemRecovery?:boolean;teacherId:string|null;studentId?:string|null;guardianId?:string|null;permissions:string[];username:string;accessControlMode?:string};
export function requirePermission(p:Principal,permission:string){
  if(!permissionContract(permission))throw deny('UNREGISTERED_PERMISSION');
  if(p.systemRecovery===true||p.permissions.includes(permission))return;
  throw deny('ROLE_PERMISSION_DENIED');
}
export async function assertTeacherStudentScope(db:Queryable,p:Principal,student:{class_id:string;section_id:string|null;academic_year_id:string|null},write=false){
  if(!p.teacherId)return;
  if(!p.teacherId)throw deny('TEACHER_NOT_LINKED');
  const teacher=await db.query('SELECT id FROM staff WHERE id=$1 AND school_id=$2 AND status=$3',[p.teacherId,p.schoolId,'Active']);
  if(!teacher.rows.length)throw deny('TEACHER_RECORD_MISSING');
  const all=await db.query<any>('SELECT * FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$2 AND active=true',[p.schoolId,p.teacherId]);
  if(!all.rows.length)throw deny('NO_ACTIVE_ASSIGNMENT');
  const today=new Date().toISOString().slice(0,10);
  let future=false,expired=false,classMatch=false,sectionMatch=false,yearMatch=false;
  for(const a of all.rows){if(a.valid_from&&String(a.valid_from).slice(0,10)>today){future=true;continue}if(a.valid_until&&String(a.valid_until).slice(0,10)<today){expired=true;continue}if(a.class_id!==student.class_id)continue;classMatch=true;if(a.section_id&&a.section_id!==student.section_id)continue;sectionMatch=true;if(a.academic_year_id&&student.academic_year_id&&a.academic_year_id!==student.academic_year_id)continue;yearMatch=true;if(a.assignment_type==='SubjectTeacher'&&write)continue;return;}
  if(!classMatch)throw deny('CLASS_OUT_OF_SCOPE');if(!sectionMatch)throw deny('SECTION_OUT_OF_SCOPE');if(!yearMatch)throw deny('ACADEMIC_YEAR_OUT_OF_SCOPE');if(future)throw deny('ASSIGNMENT_NOT_YET_ACTIVE');if(expired)throw deny('ASSIGNMENT_EXPIRED');throw deny('NO_ACTIVE_ASSIGNMENT');
}


