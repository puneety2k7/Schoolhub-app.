import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Queryable} from '../database/types.js';
import type {Principal} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
export const FINAL_ACTIONS:Record<string,string>={leave:'leave.decide',certificates:'certificate.issue',fees:'fees.applyCorrection',promotion:'promotion.activateAcademicYear'};
const names:Record<string,[string,string,string]>={leave:['wf_leave_default','Leave Approval (Default)','Final Leave Decision'],certificates:['wf_certificate_default','Certificate Issuance (Default)','Issue Certificate'],fees:['wf_fees_default','Fee Record Correction (Default)','Apply Fee Record Correction'],promotion:['wf_promotion_default','Promotion & Academic-Year Rollover (Default)','Activate Academic Year & Apply Promotions']};
export function defaultWorkflows(){return Object.entries(names).map(([module,[id,name,stepName]])=>({id,name,module,description:'Original SchoolHub default approval sequence.',enabled:true,archived:false,builtIn:true,version:1,steps:[{id:id+'_final',name:stepName,type:'SYSTEM_ACTION',required:true,disabled:false,order:1,responsibleRoleId:null,responsibleRoleNameSnapshot:null,condition:null,protectedStep:true,systemActionId:FINAL_ACTIONS[module]}]}));}
const key=z.string().min(1).max(120),condition=z.object({field:z.enum(['leaveDuration','feeAmount','certificateType']),operator:z.enum(['equals','notEquals','greaterThan','lessThan','contains']),value:z.union([z.string().max(500),z.number(),z.boolean()])}).strict().nullable().optional();
const step=z.object({id:key,name:z.string().trim().min(1).max(200),type:z.enum(['REVIEW','APPROVAL','VALIDATION','MANUAL_CHECK','NOTIFICATION','CONDITION','SYSTEM_ACTION']),required:z.boolean(),disabled:z.boolean().optional().default(false),order:z.number().int().positive(),responsibleRoleId:key.nullable().optional(),responsibleRoleNameSnapshot:z.string().max(160).nullable().optional(),condition,protectedStep:z.boolean().optional().default(false),systemActionId:key.nullable().optional()}).strict();
export const workflowSchema=z.object({id:key,name:z.string().trim().min(1).max(200),module:z.enum(['leave','fees','certificates','promotion','custom']),description:z.string().max(4000).default(''),enabled:z.boolean(),archived:z.boolean().optional().default(false),builtIn:z.boolean().optional().default(false),version:z.number().int().positive(),steps:z.array(step).min(1).max(50)}).strict();
export const workflowSettingsSchema=z.object({definitions:z.array(workflowSchema).max(100),policies:z.record(z.string().max(120),z.boolean()),version:z.number().int().nonnegative()}).strict();
export async function workflowSettings(tx:Queryable,schoolId:string,ensure=false){
 if(ensure)await tx.query('INSERT INTO operation_workflow_settings(school_id,definitions,policies,version) VALUES($1,$2,$3,0) ON CONFLICT(school_id) DO NOTHING',[schoolId,JSON.stringify(defaultWorkflows()),'{}']);
 return (await tx.query<any>('SELECT definitions,policies,version FROM operation_workflow_settings WHERE school_id=$1'+(ensure?' FOR UPDATE':''),[schoolId])).rows[0]||{definitions:defaultWorkflows(),policies:{},version:0};
}
export async function validateWorkflows(tx:Queryable,p:Principal,input:z.infer<typeof workflowSettingsSchema>,old:any){
 if(new Set(input.definitions.map(w=>w.id)).size!==input.definitions.length)throw new ApiError('VALIDATION_FAILED','Workflow IDs must be unique.',422);
 const roles=(await tx.query<any>('SELECT id,name FROM roles WHERE school_id=$1',[p.schoolId])).rows;
 for(const prior of old.definitions)if(prior.builtIn&&!input.definitions.some(w=>w.id===prior.id&&w.builtIn&&w.module===prior.module))throw new ApiError('VALIDATION_FAILED','Built-in workflows cannot be removed or change module.',422);
 for(const w of input.definitions){
  if(new Set(w.steps.map(s=>s.id)).size!==w.steps.length||new Set(w.steps.map(s=>s.order)).size!==w.steps.length)throw new ApiError('VALIDATION_FAILED','Workflow step IDs and order must be unique.',422);
  if(w.builtIn&&!defaultWorkflows().some(d=>d.id===w.id&&d.module===w.module))throw new ApiError('VALIDATION_FAILED','Invalid built-in workflow identity.',422);
  const active=w.steps.filter(s=>!s.disabled).sort((a,b)=>a.order-b.order),final=FINAL_ACTIONS[w.module];
  if(!active.length)throw new ApiError('VALIDATION_FAILED','A workflow needs an active step.',422);
  if(final&&(active.at(-1)?.systemActionId!==final||active.filter(s=>s.systemActionId===final).length!==1))throw new ApiError('VALIDATION_FAILED','The protected final action must appear exactly once, at the end.',422);
  for(const s of w.steps){
   if(s.type==='SYSTEM_ACTION'&&(s.systemActionId!==final||!s.protectedStep||s.disabled||!s.required))throw new ApiError('VALIDATION_FAILED','Invalid protected workflow action.',422);
   if(s.type!=='SYSTEM_ACTION'&&(s.systemActionId||s.protectedStep))throw new ApiError('VALIDATION_FAILED','Only system steps may have a protected action.',422);
   if(s.responsibleRoleId){const r=roles.find(r=>r.id===s.responsibleRoleId);if(!r)throw new ApiError('VALIDATION_FAILED','Select a role belonging to this school.',422);s.responsibleRoleNameSnapshot=r.name;}
  }
  const previous=old.definitions.find((x:any)=>x.id===w.id),fingerprint=(x:any)=>JSON.stringify(x.steps.map((s:any)=>({id:s.id,type:s.type,order:s.order,disabled:!!s.disabled,responsibleRoleId:s.responsibleRoleId||null,condition:s.condition||null,systemActionId:s.systemActionId||null,required:!!s.required})));
  w.version=previous?previous.version+(fingerprint(previous)!==fingerprint(w)?1:0):1;
 }
 const instances=(await tx.query<any>('SELECT workflow_id FROM operation_workflow_instances WHERE school_id=$1',[p.schoolId])).rows;
 if(instances.some(i=>!input.definitions.some(w=>w.id===i.workflow_id)))throw new ApiError('VALIDATION_FAILED','Archive used workflows instead of deleting their history.',422);
}
export async function startWorkflow(tx:Queryable,p:Principal,module:string,subjectId:string,title:string,contextData:Record<string,unknown>){
 const settings=await workflowSettings(tx,p.schoolId,true),wf=settings.definitions.find((w:any)=>w.module===module&&w.enabled&&!w.archived);
 if(!wf)throw new ApiError('WORKFLOW_UNAVAILABLE','No enabled approval workflow is configured.',422);
 const steps=wf.steps.filter((s:any)=>!s.disabled).sort((a:any,b:any)=>a.order-b.order);if(!steps.length)throw new ApiError('WORKFLOW_UNAVAILABLE','Workflow has no active steps.',422);
 const id=randomUUID(),now=new Date().toISOString(),data={id,workflowId:wf.id,workflowVersion:wf.version,stepsSnapshot:steps,subjectType:module,subjectId,title,contextData,currentStepId:steps[0].id,status:'In Progress',createdDate:now.slice(0,10),createdBy:p.username,completedDate:null,history:[{stepId:steps[0].id,stepNameSnapshot:steps[0].name,actor:p.username,actorRole:p.roleName,action:'Created',timestamp:now,note:''}]};
 await tx.query('INSERT INTO operation_workflow_instances(id,school_id,workflow_id,subject_type,subject_id,data) VALUES($1,$2,$3,$4,$5,$6)',[id,p.schoolId,wf.id,module,subjectId,JSON.stringify(data)]);return data;
}
export async function advanceOperation(tx:Queryable,p:Principal,module:string,subjectId:string,decision:'Approved'|'Rejected',note:string){
 const row=(await tx.query<any>('SELECT id,data,version FROM operation_workflow_instances WHERE school_id=$1 AND subject_type=$2 AND subject_id=$3 FOR UPDATE',[p.schoolId,module,subjectId])).rows[0];if(!row||row.data.status!=='In Progress')throw new ApiError('WORKFLOW_UNAVAILABLE','This request has no pending workflow.',409);
 const data=row.data,index=data.stepsSnapshot.findIndex((s:any)=>s.id===data.currentStepId),step=data.stepsSnapshot[index];if(!step)throw new ApiError('WORKFLOW_UNAVAILABLE','Current workflow step is missing.',409);
 if(step.responsibleRoleId&&step.responsibleRoleId!==p.roleId)throw new ApiError('FORBIDDEN','This step requires its assigned role.',403);
 const settings=await workflowSettings(tx,p.schoolId);const requireReason=settings.policies[module+'.requireRejectionReason']??(module==='leave');if(decision==='Rejected'&&requireReason&&!note.trim())throw new ApiError('VALIDATION_FAILED','A rejection reason is required.',422);
 const now=new Date().toISOString();data.history.push({stepId:step.id,stepNameSnapshot:step.name,actor:p.username,actorRole:p.roleName,action:decision,timestamp:now,note});
 const final=step.type==='SYSTEM_ACTION'&&step.systemActionId===FINAL_ACTIONS[module];
 if(decision==='Rejected'){data.status='Rejected';data.completedDate=now.slice(0,10);}else if(index===data.stepsSnapshot.length-1){data.status='Completed';data.completedDate=now.slice(0,10);}else data.currentStepId=data.stepsSnapshot[index+1].id;
 await tx.query('UPDATE operation_workflow_instances SET data=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$2 AND id=$3',[JSON.stringify(data),p.schoolId,row.id]);return {final,rejected:decision==='Rejected',instance:data};
}
