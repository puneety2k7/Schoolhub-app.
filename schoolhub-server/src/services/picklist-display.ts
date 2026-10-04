import type {Queryable} from '../database/types.js';
export const SYSTEM_PICKLISTS:Record<string,string[]>={
 attendanceStatus:['Present','Absent','Late'],studentStatus:['Active','Inactive','Archived'],
 leaveStatus:['Pending','Approved','Rejected'],homeworkStatus:['Draft','Published','Inactive'],
 homeworkAcknowledgementStatus:['ASSIGNED','SEEN','IN_PROGRESS','COMPLETED','NEED_HELP'],
 calendarStatus:['Active','Inactive','Cancelled'],documentStatus:['Draft','Active','Archived','Inactive'],
 noticeStatus:['Draft','Published','Inactive'],classStatus:['Active','Inactive'],workLogStatus:['Draft','Saved']
};
export function defaultPicklistColor(value:string){const v=value.toLowerCase();return ['present','active','approved','published','completed','saved'].includes(v)?'green':['absent','rejected','cancelled','need_help'].includes(v)?'red':['late','pending','draft','in_progress'].includes(v)?'amber':['inactive','archived'].includes(v)?'gray':['exam','examination'].includes(v)?'purple':['holiday'].includes(v)?'red':['meeting','activity','sports'].includes(v)?'teal':'blue'}
export async function markSystemPicklists(db:Queryable,schoolId:string){for(const key of Object.keys(SYSTEM_PICKLISTS))await db.query("UPDATE picklist_definitions SET is_system=true WHERE school_id=$1 AND picklist_key=$2 AND source_type='AdminDefined' AND is_system=false",[schoolId,key])}

