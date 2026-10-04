import {AUTHORIZATION_ACTIONS,registeredWorkspaceKeys,scopesForAction,workspaceManifest,type AuthorizationAction,type AuthorizationScope} from './policy-registry.js';
export const UNIVERSAL_PERMISSION_ACTIONS = Object.freeze([
 'record.view','record.create','record.update','record.archive','record.restore','record.permanent_delete',
 'record.print','record.export','attachment.view','attachment.download','attachment.upload','attachment.delete',
 'audit.view','record.publish','record.unpublish','record.manage_audience','record.manage_assignees',
 'record.acknowledge','acknowledgement.view_status','recipient.view_status','submission.create','submission.view','submission.update','submission.withdraw','submission.grade','submission.return','submission.view_status',
 'import.validate','import.execute','workspace.configure'
] as const satisfies readonly AuthorizationAction[]);

const universalActionSet=new Set<AuthorizationAction>(UNIVERSAL_PERMISSION_ACTIONS);
const featureForAction=(action:AuthorizationAction)=>action.startsWith('attachment.')?'attachments':action==='record.print'?'printing':action==='record.export'?'export':action==='audit.view'?'changeLog':action==='record.publish'||action==='record.unpublish'?'publication':action==='record.manage_audience'?'audience':action==='record.acknowledge'||action==='acknowledgement.view_status'?'acknowledgement':action==='recipient.view_status'?'deliveryStatus':action.startsWith('submission.')?'submission':action.startsWith('import.')?'imports':action==='workspace.configure'?'administration':'records';

const labels:Partial<Record<AuthorizationAction,string>>={
 'record.view':'View Records','record.create':'Add Records','record.update':'Edit Records','record.archive':'Archive Records',
 'record.unarchive':'Unarchive Records','record.delete':'Delete Records','record.restore':'Restore Records',
 'record.permanent_delete':'Permanent Delete Records','record.publish':'Publish Records','record.unpublish':'Unpublish Records',
 'record.print':'Print Records','record.export':'Export Records','record.transfer_ownership':'Transfer Ownership',
 'record.manage_audience':'Manage Audience','record.manage_assignees':'Manage Assignees',
 'record.manage_relationships':'Manage Relationships','record.change_sensitivity':'Change Sensitivity','record.override_locks':'Override Record Locks',
 'record.acknowledge':'Acknowledge Records','acknowledgement.view_status':'View Acknowledgement Status','recipient.view_status':'View Recipient / Delivery Status','submission.create':'Submit Response','submission.view':'View Submissions',
 'submission.update':'Edit Own Submission','submission.withdraw':'Withdraw Submission','submission.grade':'Grade Submission',
 'submission.return':'Return Submission','submission.view_status':'View Submission Status','attachment.view':'View Attachments','attachment.download':'Download Attachments',
 'attachment.upload':'Add Attachments','attachment.delete':'Delete Attachments','audit.view':'View Change Log',
 'report.view':'View Reports','report.create':'Create Reports','report.share':'Share Reports','report.export':'Export Reports',
 'import.validate':'Validate Import','import.execute':'Run Import','bulk.execute':'Run Bulk Operation',
 'notification.send':'Send Notification','notification.manage_templates':'Manage Notification Templates',
 'attendance.mark':'Mark Attendance','attendance.correct':'Correct Attendance','attendance.lock':'Lock Attendance',
 'attendance.unlock':'Unlock Attendance','assessment.enter_marks':'Enter Marks','assessment.moderate':'Moderate Marks',
 'assessment.publish_results':'Publish Results','assessment.reopen_results':'Reopen Results',
 'fee.invoice_create':'Create Invoice','fee.payment_record':'Record Payment','fee.concession_approve':'Approve Concession',
 'fee.refund':'Refund Payment','fee.reconcile':'Reconcile Fees','workflow.submit':'Submit Workflow',
 'workflow.review':'Review Workflow','workflow.approve':'Approve Workflow','workflow.reject':'Reject Workflow',
 'workflow.return':'Return Workflow','workflow.cancel':'Cancel Workflow','student.deactivate':'Deactivate Student',
 'access.roles.read':'View Access Roles','access.roles.manage':'Manage Access Roles','access.groups.read':'View Access Groups',
 'access.groups.manage':'Manage Access Groups','access.memberships.manage':'Manage Group Memberships',
 'access.grants.manage':'Manage Role Grants','access.preview':'Preview Authorization','users.manage':'Manage Users',
 'guardian_links.manage':'Manage Guardian Links','teaching_assignments.manage':'Manage Teaching Assignments',
 'workspace.configure':'Configure Workspace','portal.configure':'Configure Portal','integrations.manage':'Manage Integrations',
 'audit.security_view':'View Security Audit','diagnostics.view':'View Diagnostics','diagnostics.export':'Export Diagnostics',
 'school.read':'View School Settings','school.manage':'Manage School Settings'
};

const descriptions:Partial<Record<AuthorizationAction,string>>={
 'record.view':'Read records matching one of the actor\'s valid view scopes.',
 'record.create':'Create a record only within a validated creation scope.',
 'record.update':'Modify only records matching the update grant and writable-field policy.',
 'record.archive':'Archive an authorized record without permanent deletion.',
 'record.delete':'Soft-delete only where the resource implements deletion.',
 'record.permanent_delete':'Permanently delete only where explicitly supported and safeguards pass.',
 'record.publish':'Release a record to a validated audience.',
 'record.override_locks':'Apply an otherwise permitted action while a record is locked.',
 'record.unpublish':'Withdraw publication while preserving required history.',
 'record.print':'Generate a printable representation of authorized fields.',
 'record.export':'Export only authorized records and authorized fields.',
 'record.manage_audience':'Change distribution only within a valid assignment scope.',
 'record.acknowledge':'Record acknowledgement by an eligible recipient or guardian.',
 'acknowledgement.view_status':'View acknowledgement state only for authorized recipients, children, or operational staff.',
 'recipient.view_status':'View delivery status only for an authorized audience or operational scope.',
 'submission.create':'Create an authorized private submission.',
 'submission.update':'Modify an eligible owned submission under business rules.',
 'submission.withdraw':'Withdraw an eligible owned submission.',
 'submission.grade':'Grade submissions in an authorized teaching context.',
 'submission.return':'Return submitted work through an authorized workflow.',
 'submission.view_status':'View submission state only within the authorized personal or operational scope.',
 'attachment.view':'View attachment metadata for an authorized record.',
 'attachment.download':'Download attachment bytes for an authorized record.',
 'attachment.upload':'Add attachments to an authorized record.',
 'attachment.delete':'Delete attachments from an authorized record.',
 'audit.view':'View change history within the authorized workspace scope.'
};

const special=(action:AuthorizationAction,scopes:readonly AuthorizationScope[])=>{
 const requirements:string[]=[];
 if(scopes.some(x=>x.startsWith('CHILD_')))requirements.push('Active guardian-to-student relationship');
 if(scopes.some(x=>x.startsWith('ASSIGNED_')))requirements.push('Active server-side teaching/assignment relationship');
 if(scopes.includes('DIRECT_RECIPIENT'))requirements.push('Server-derived recipient relationship');
 if(action==='record.view'||action==='record.print'||action==='record.export')requirements.push('Lifecycle, sensitivity, and field-disclosure constraints still apply');
 if(action==='record.permanent_delete')requirements.push('Explicit resource support, confirmation, dependency checks, and Setup Administration');
 return requirements;
};

export function authorizationPermissionCatalog(){
 return AUTHORIZATION_ACTIONS.flatMap(action=>{
  const supportedResources=Object.entries(workspaceAuthorizationCatalog()).flatMap(([workspaceKey,resources])=>resources.flatMap(resource=>resource.actions.filter(item=>item.action===action).map(item=>({workspaceKey,resourceType:resource.resourceType,scopes:item.scopes}))));
  if(!supportedResources.length)return[];
  const scopes=[...new Set(supportedResources.flatMap(item=>item.scopes))] as AuthorizationScope[];
  return[{key:action,label:labels[action]||action.split('.').map(x=>x.replace(/_/g,' ')).join(' / '),description:descriptions[action]||'Perform this server-authorized action only within a matching grant and scope.',supportedResources,scopes,specialRequirements:special(action,scopes)}];
 });
}

export function workspaceAuthorizationCatalog(){
 const keys=registeredWorkspaceKeys();
 return Object.fromEntries(keys.map(workspaceKey=>[workspaceKey,workspaceManifest(workspaceKey).map(resource=>({resourceType:resource.resourceType,features:[...new Set(resource.actions.filter(action=>universalActionSet.has(action)).map(featureForAction))],actions:resource.actions.filter(action=>universalActionSet.has(action)).map(action=>({action,scopes:scopesForAction(resource,action)})),workflowPermissions:resource.actions.filter(action=>!universalActionSet.has(action)).map(action=>({action,scopes:scopesForAction(resource,action)}))}))]));
}
export function universalPermissionCatalog(){return authorizationPermissionCatalog().filter(item=>universalActionSet.has(item.key as AuthorizationAction))}

export function workspaceWorkflowPermissionCatalog(){
 return Object.fromEntries(Object.entries(workspaceAuthorizationCatalog()).map(([workspaceKey,resources])=>[workspaceKey,resources.flatMap(resource=>resource.workflowPermissions.map(item=>({resourceType:resource.resourceType,...item}))) ]).filter(([,items])=>(items as unknown[]).length>0));
}