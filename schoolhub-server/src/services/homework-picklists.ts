import type { Queryable } from '../database/types.js';
import {defaultPicklistColor} from './picklist-display.js';

export const homeworkLists = {
 transportStatus:{name:'Transport Status',values:['Active','Inactive'].map(x=>[x,x])},
 transportShift:{name:'Transport Shift',values:['Morning','Afternoon','Both'].map(x=>[x,x])},
 transportVehicle:{name:'Transport Vehicle',values:[] as string[][]},
 attendanceStatus:{name:'Attendance Status',values:['Present','Absent','Late'].map(x=>[x,x])},
 studentStatus:{name:'Student Status',values:['Active','Inactive','Archived'].map(x=>[x,x])},
 documentCategory:{name:'Document Category',values:['Admission','Consent','General','Finance','Transport','Health & Safety','Examination','Library','Policy','Circular','Other'].map(x=>[x,x])},
 documentStatus:{name:'Document Status',values:['Draft','Active','Archived','Inactive'].map(x=>[x,x])},
 documentAudience:{name:'Document Audience Type',values:['All','Students','Parents','Teachers','Staff','Class','Section','Individual'].map(x=>[x,x])},
 calendarEventType:{name:'Calendar Event Type',values:['Holiday','Exam','Meeting','Activity','Sports','Cultural Event','Workshop','Reminder','Other','School Activity','PTM','Event'].map(x=>[x,x])},
 calendarCategory:{name:'Calendar Category',values:['National','Religious','Academic','Administrative','Cultural','Sports','Other','Other fixed-date','Computed','Lunar / lunisolar','State','Imported'].map(x=>[x,x])},
 calendarStatus:{name:'Calendar Status',values:['Active','Inactive','Cancelled'].map(x=>[x,x])},
 calendarAudience:{name:'Calendar Audience',values:['All','Teachers','Students','Parents','Staff','Class','Section','Individual'].map(x=>[x,x])},
 calendarHolidayType:{name:'Holiday Type',values:['National','Religious','School Holiday','Local Holiday','Optional Holiday'].map(x=>[x,x])},
 leaveApplicantType:{name:'Leave Applicant Type',values:[['Student','Student'],['Staff','Staff']]},
 leaveType:{name:'Leave Type',values:[['Sick Leave','Sick Leave'],['Medical Appointment','Medical Appointment'],['Family Function','Family Function'],['Personal Leave','Personal Leave'],['Emergency Leave','Emergency Leave'],['Official Duty','Official Duty'],['Other','Other']]},
 leaveStatus:{name:'Leave Status',values:[['Pending','Pending'],['Approved','Approved'],['Rejected','Rejected']]},
 leavePriority:{name:'Leave Priority',values:[['Normal','Normal'],['High','High'],['Urgent','Urgent']]},
 noticeAudience:{name:'Notice Audience',values:[['All','All'],['Students','Students'],['Parents','Parents'],['Teachers','Teachers']]},
 noticePriority:{name:'Notice Priority',values:[['Low','Low'],['Normal','Normal'],['High','High'],['Urgent','Urgent']]},
 noticeStatus:{name:'Notice Status',values:[['Draft','Draft'],['Published','Published'],['Inactive','Inactive']]},
 classStatus:{name:'Class Status',values:[['Active','Active'],['Inactive','Inactive']]},
 teacherSubstitutionReason:{name:'Teacher Substitution Reason',values:[['TEACHER_LEAVE','Teacher on Leave'],['ABSENT','Teacher Absent'],['OFFICIAL_DUTY','Official Duty'],['TRAINING','Training'],['EXAM_DUTY','Exam Duty'],['EMERGENCY','Emergency'],['OTHER','Other']]},
 workLogStatus:{name:'Work Log Status',values:[['Draft','Draft'],['Saved','Saved']]},
 homeworkStatus: {name:'Homework Status',values:[['Draft','Draft'],['Published','Published'],['Inactive','Inactive']]},
 homeworkAcknowledgementStatus: {name:'Homework Acknowledgement Status',values:[['ASSIGNED','Assigned'],['SEEN','Seen'],['IN_PROGRESS','In Progress'],['COMPLETED','Completed'],['NEED_HELP','Need Help']]}
};
export async function ensureHomeworkPicklists(db:Queryable,schoolId:string){
 for(const [key,list] of Object.entries(homeworkLists)){
  const existing=(await db.query('SELECT id FROM picklist_definitions WHERE school_id=$1 AND picklist_key=$2',[schoolId,key])).rows[0];
  if(existing)continue;
  const id=key+'-'+schoolId;
  const inserted=await db.query('INSERT INTO picklist_definitions(id,school_id,picklist_key,name,source_type) VALUES($1,$2,$3,$4,$5) ON CONFLICT(school_id,picklist_key) DO NOTHING RETURNING id',[id,schoolId,key,list.name,'AdminDefined']);
  if(!inserted.rows.length)continue;
  const values=key==='transportVehicle'?[...new Set((await db.query<any>('SELECT data FROM transport_routes WHERE school_id=$1',[schoolId])).rows.map(x=>String(x.data.vehicle||'').trim()).filter(Boolean))].map(x=>[x,x]):list.values;
  for(const [i,[value,label]] of values.entries())await db.query('INSERT INTO picklist_values(id,school_id,picklist_id,value,label,sort_order,color) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',[id+'-'+value,schoolId,id,value,label,i,defaultPicklistColor(value)]);
 }
}
export async function readHomeworkPicklist(db:Queryable,schoolId:string,key:string){
 return (await db.query<any>('SELECT v.value,v.label,v.active,v.color,d.id AS "picklistId" FROM picklist_values v JOIN picklist_definitions d ON d.id=v.picklist_id AND d.school_id=v.school_id WHERE d.school_id=$1 AND d.picklist_key=$2 AND d.active=true ORDER BY v.sort_order,v.id',[schoolId,key])).rows;
}
