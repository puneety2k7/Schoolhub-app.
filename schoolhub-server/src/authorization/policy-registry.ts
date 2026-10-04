export const AUTHORIZATION_SCOPES = [
  'OWNED','CREATED_BY','SELF','DIRECT_ASSIGNED','DIRECT_RECIPIENT','GROUP','CLASS','SECTION','AUDIENCE',
  'CHILD_PERSONAL','CHILD_ASSIGNED','CHILD_RECIPIENT','ASSIGNED_TEACHING_CONTEXT','ASSIGNED_CLASS',
  'ASSIGNED_SECTION','ASSIGNED_STUDENT','CASE_ASSIGNED','DEPARTMENT','CLUB','HOUSE','ROUTE','HOSTEL',
  'SCHOOL_PUBLISHED','ALL_WORKSPACE'
] as const;

export type AuthorizationScope = typeof AUTHORIZATION_SCOPES[number];

export const AUTHORIZATION_ACTIONS = [
  'record.view','record.create','record.update','record.archive','record.unarchive','record.delete','record.restore',
  'record.permanent_delete','record.publish','record.unpublish','record.print','record.export','record.transfer_ownership',
  'record.manage_audience','record.manage_assignees','record.manage_relationships','record.change_sensitivity','record.override_locks',
  'record.acknowledge','acknowledgement.view_status','recipient.view_status','submission.create','submission.view','submission.update','submission.withdraw','submission.grade',
  'submission.return','submission.view_status','attachment.view','attachment.download','attachment.upload','attachment.delete','audit.view',
  'report.view','report.create','report.share','report.export','import.validate','import.execute','bulk.execute',
  'notification.send','notification.manage_templates','attendance.mark','attendance.correct','attendance.lock',
  'attendance.unlock','assessment.enter_marks','assessment.moderate','assessment.publish_results',
  'assessment.reopen_results','fee.invoice_create','fee.payment_record','fee.concession_approve','fee.refund',
  'fee.reconcile','workflow.submit','workflow.review','workflow.approve','workflow.reject','workflow.return',
  'workflow.cancel','student.deactivate','access.roles.read','access.roles.manage','access.groups.read',
  'access.groups.manage','access.memberships.manage','access.grants.manage','access.preview','users.manage',
  'guardian_links.manage','teaching_assignments.manage','workspace.configure','portal.configure',
  'integrations.manage','audit.security_view','diagnostics.view','diagnostics.export','school.read','school.manage'
] as const;

export type AuthorizationAction = typeof AUTHORIZATION_ACTIONS[number];

export type PermissionContract = Readonly<{
  permission: string;
  workspaceKey: string;
  resourceType: string;
  action: AuthorizationAction;
  allowedScopes: readonly AuthorizationScope[];
  description: string;
  legacyAmbiguous?: boolean;
}>;

const all: readonly AuthorizationScope[] = ['ALL_WORKSPACE'];
const scoped: readonly AuthorizationScope[] = ['OWNED','CREATED_BY','SELF','DIRECT_ASSIGNED','DIRECT_RECIPIENT','GROUP','CLASS','SECTION','AUDIENCE','CHILD_PERSONAL','CHILD_ASSIGNED','CHILD_RECIPIENT','ASSIGNED_TEACHING_CONTEXT','ASSIGNED_CLASS','ASSIGNED_SECTION','ASSIGNED_STUDENT','CASE_ASSIGNED','DEPARTMENT','CLUB','HOUSE','ROUTE','HOSTEL','SCHOOL_PUBLISHED','ALL_WORKSPACE'];

const workspaceAliases: Readonly<Record<string,string>> = Object.freeze({
  teacherlog:'teacher-work-log',fees:'fees-payments',leave:'leave-requests',calendar:'calendar-holidays',
  rules:'rules-regulations',exams:'exams-results',marks:'exams-results',reportcards:'exams-results'
});

const descriptions: Readonly<Record<string,string>> = Object.freeze({
  view:'View authorized records.',create:'Create records within an authorized target context.',update:'Update authorized records.',
  delete:'Archive authorized records.',print:'Generate authorized printable output.',publish:'Publish an authorized record.',
  restore:'Restore an authorized archived record.',deactivate:'Deactivate an authorized student enrollment.'
});

function conventional(permission:string):PermissionContract|null{
  const match=/^([a-z][a-z0-9-]*):(view|create|update|delete|print|publish|restore|deactivate)$/.exec(permission);
  if(!match)return null;
  const raw=match[1],verb=match[2],workspaceKey=workspaceAliases[raw]||raw;
  const resourceType=raw==='marks'?'mark':raw==='reportcards'?'report-card':raw==='exams'?'exam':workspaceKey.replace(/s$/,'');
  const action:AuthorizationAction=verb==='view'?'record.view':verb==='create'?'record.create':verb==='update'?'record.update':verb==='delete'?'record.archive':verb==='print'?'record.print':verb==='publish'?'record.publish':verb==='restore'?'record.restore':'student.deactivate';
  return Object.freeze({permission,workspaceKey,resourceType,action,allowedScopes:verb==='create'?scoped:scoped,description:descriptions[verb]});
}

const explicit: Readonly<Record<string,Omit<PermissionContract,'permission'>>> = Object.freeze({
  'school:read':{workspaceKey:'school',resourceType:'school-settings',action:'school.read',allowedScopes:all,description:'Read school configuration.'},
  'school:manage':{workspaceKey:'school',resourceType:'school-settings',action:'school.manage',allowedScopes:all,description:'Manage school configuration.'},
  'core:manage':{workspaceKey:'school',resourceType:'academic-core',action:'workspace.configure',allowedScopes:all,description:'Manage core academic reference data.',legacyAmbiguous:true},
  'users:view':{workspaceKey:'users',resourceType:'user',action:'record.view',allowedScopes:all,description:'View school user accounts.'},
  'users:manage':{workspaceKey:'users',resourceType:'user',action:'users.manage',allowedScopes:all,description:'Manage school user accounts.'},
  'audit:view':{workspaceKey:'access',resourceType:'security-audit',action:'audit.security_view',allowedScopes:all,description:'View security audit records.'},
  'diagnostics:view':{workspaceKey:'diagnostics',resourceType:'diagnostics',action:'diagnostics.view',allowedScopes:all,description:'View server diagnostics.'},
  'diagnostics:export':{workspaceKey:'diagnostics',resourceType:'diagnostics',action:'diagnostics.export',allowedScopes:all,description:'Export a redacted diagnostic bundle.'},
  'portal:manage':{workspaceKey:'portal',resourceType:'portal-configuration',action:'portal.configure',allowedScopes:all,description:'Configure role portals.'},
  'portal:admin':{workspaceKey:'portal',resourceType:'portal-administration',action:'portal.configure',allowedScopes:all,description:'Administer portal identities.',legacyAmbiguous:true},
  'portal:self':{workspaceKey:'portal',resourceType:'portal-profile',action:'record.view',allowedScopes:['SELF'],description:'View the signed-in portal profile.'},
  'imports:manage':{workspaceKey:'imports',resourceType:'school-import',action:'import.execute',allowedScopes:all,description:'Execute a validated school import.',legacyAmbiguous:true},
  'workspaces:view':{workspaceKey:'access',resourceType:'workspace-definition',action:'record.view',allowedScopes:all,description:'View workspace definitions.'},
  'workspaces:create':{workspaceKey:'access',resourceType:'workspace-definition',action:'record.create',allowedScopes:all,description:'Create workspace definitions.'},
  'workspaces:configure':{workspaceKey:'access',resourceType:'workspace-definition',action:'workspace.configure',allowedScopes:all,description:'Configure workspace definitions.'},
  'workspaces:archive':{workspaceKey:'access',resourceType:'workspace-definition',action:'record.archive',allowedScopes:all,description:'Archive workspace definitions.'},
  'workspaces:reset':{workspaceKey:'access',resourceType:'workspace-definition',action:'record.restore',allowedScopes:all,description:'Restore a built-in workspace definition.'},
  'attendance:manage':{workspaceKey:'attendance',resourceType:'attendance-entry',action:'attendance.mark',allowedScopes:scoped,description:'Legacy attendance mutation permission pending route-specific split.',legacyAmbiguous:true},
  'timetable:manage':{workspaceKey:'timetable',resourceType:'timetable-entry',action:'record.update',allowedScopes:scoped,description:'Legacy timetable mutation permission pending route-specific split.',legacyAmbiguous:true},
  'homework:manage':{workspaceKey:'homework',resourceType:'homework',action:'record.update',allowedScopes:scoped,description:'Legacy Homework mutation permission. New handlers use explicit actions.',legacyAmbiguous:true},
  'exams:manage':{workspaceKey:'exams-results',resourceType:'exam',action:'record.update',allowedScopes:scoped,description:'Legacy assessment mutation permission pending route-specific split.',legacyAmbiguous:true},
  'marks:manage':{workspaceKey:'exams-results',resourceType:'mark',action:'assessment.enter_marks',allowedScopes:scoped,description:'Enter marks for an authorized assessment context.',legacyAmbiguous:true},
  'marks:correct':{workspaceKey:'exams-results',resourceType:'mark',action:'assessment.moderate',allowedScopes:scoped,description:'Correct marks in an authorized assessment context.'},
  'marks:publish':{workspaceKey:'exams-results',resourceType:'mark',action:'assessment.publish_results',allowedScopes:scoped,description:'Publish results for an authorized assessment context.'},
  'promotion:manage':{workspaceKey:'students',resourceType:'student-promotion',action:'workflow.approve',allowedScopes:scoped,description:'Approve student promotion or rollover decisions.',legacyAmbiguous:true},
  'reportcards:view':{workspaceKey:'exams-results',resourceType:'report-card',action:'report.view',allowedScopes:scoped,description:'View authorized report cards.'},
  'reportcards:publish':{workspaceKey:'exams-results',resourceType:'report-card',action:'assessment.publish_results',allowedScopes:scoped,description:'Publish authorized report cards.'},
  'reports:view':{workspaceKey:'reports',resourceType:'report',action:'report.view',allowedScopes:scoped,description:'View authorized reports.'},
  'reports:print':{workspaceKey:'reports',resourceType:'report',action:'report.export',allowedScopes:scoped,description:'Generate authorized report output.'},
  'workflows:view':{workspaceKey:'workflows',resourceType:'workflow',action:'record.view',allowedScopes:scoped,description:'View authorized workflows.'},
  'workflows:manage':{workspaceKey:'workflows',resourceType:'workflow',action:'workspace.configure',allowedScopes:all,description:'Configure workflows.',legacyAmbiguous:true},
  'assets:view':{workspaceKey:'assets',resourceType:'asset',action:'record.view',allowedScopes:all,description:'View authorized assets.'},
  'assets:create':{workspaceKey:'assets',resourceType:'asset',action:'record.create',allowedScopes:all,description:'Create assets.'},
  'assets:update':{workspaceKey:'assets',resourceType:'asset',action:'record.update',allowedScopes:all,description:'Update assets.'},
  'assets:delete':{workspaceKey:'assets',resourceType:'asset',action:'record.archive',allowedScopes:all,description:'Archive assets.'},
  'assets:print':{workspaceKey:'assets',resourceType:'asset',action:'record.print',allowedScopes:all,description:'Print assets.'},
  'assets:manage':{workspaceKey:'assets',resourceType:'asset',action:'record.update',allowedScopes:all,description:'Legacy asset mutation permission pending action split.',legacyAmbiguous:true},
  'idcards:view':{workspaceKey:'idcards',resourceType:'digital-id-card',action:'record.view',allowedScopes:['SELF','ALL_WORKSPACE'],description:'View authorized digital ID cards.'},
  'idcards:create':{workspaceKey:'idcards',resourceType:'digital-id-card',action:'record.create',allowedScopes:all,description:'Issue digital ID cards.'},
  'idcards:update':{workspaceKey:'idcards',resourceType:'digital-id-card',action:'record.update',allowedScopes:all,description:'Replace digital ID cards.'},
  'idcards:delete':{workspaceKey:'idcards',resourceType:'digital-id-card',action:'record.archive',allowedScopes:all,description:'Revoke digital ID cards.'},
  'idcards:manage':{workspaceKey:'idcards',resourceType:'digital-id-card',action:'record.update',allowedScopes:all,description:'Legacy digital ID mutation permission pending action split.',legacyAmbiguous:true},
  'idcards:print':{workspaceKey:'idcards',resourceType:'digital-id-card',action:'record.print',allowedScopes:['SELF','ALL_WORKSPACE'],description:'Print authorized digital ID cards.'}
});

export function permissionContract(permission:string):PermissionContract|null{
  const item=explicit[permission];
  if(item)return Object.freeze({permission,...item});
  return conventional(permission);
}

export function requireRegisteredPermission(permission:string):PermissionContract{
  const contract=permissionContract(permission);
  if(!contract)throw new Error('Unregistered server permission: '+permission);
  return contract;
}

export function isScopeAllowed(contract:PermissionContract,scope:AuthorizationScope){return contract.allowedScopes.includes(scope)}


export type ResourcePolicy=Readonly<{resourceType:string;actions:readonly AuthorizationAction[];scopes:readonly AuthorizationScope[];actionScopes:Readonly<Partial<Record<AuthorizationAction,readonly AuthorizationScope[]>>>}>;
const records:readonly AuthorizationAction[]=['record.view','record.create','record.update','record.archive','record.restore','record.print','record.export','attachment.view','attachment.download','attachment.upload','attachment.delete','audit.view'];
const readActions=new Set<AuthorizationAction>(['record.view','record.print','record.export','attachment.view','attachment.download','audit.view','report.view','report.export']);
const recipientActions=new Set<AuthorizationAction>(['record.acknowledge','submission.create','submission.view','submission.update','submission.withdraw']);
function defaultScopesForAction(action:AuthorizationAction,allowed:readonly AuthorizationScope[]):readonly AuthorizationScope[]{
 const preferred=readActions.has(action)?allowed:recipientActions.has(action)?['SELF','DIRECT_RECIPIENT','CHILD_RECIPIENT']:action==='submission.grade'||action==='submission.return'?['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE']:['OWNED','CREATED_BY','DIRECT_ASSIGNED','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'];
 const result=preferred.filter((scope):scope is AuthorizationScope=>allowed.includes(scope as AuthorizationScope));
 return result.length?result:allowed.includes('ALL_WORKSPACE')?all:allowed;
}
const universalWorkspaceActions:readonly AuthorizationAction[]=['record.view','record.create','record.update','record.archive','record.restore','record.print','record.permanent_delete','record.publish','record.unpublish','record.transfer_ownership','record.manage_assignees','record.acknowledge','record.override_locks','audit.view','import.validate','import.execute','workflow.submit','workflow.review','workflow.approve','workflow.reject','workflow.return','workflow.cancel'];
const record=(resourceType:string,actions:readonly AuthorizationAction[]=records,scopes:readonly AuthorizationScope[]=scoped,overrides:Readonly<Partial<Record<AuthorizationAction,readonly AuthorizationScope[]>>>={}):ResourcePolicy=>{
 const effectiveActions=[...new Set<AuthorizationAction>([...universalWorkspaceActions,...actions])];
 const actionScopes=Object.fromEntries(effectiveActions.map(action=>[action,Object.freeze([...(overrides[action]||defaultScopesForAction(action,scopes))])])) as Partial<Record<AuthorizationAction,readonly AuthorizationScope[]>>;
 return Object.freeze({resourceType,actions:Object.freeze(effectiveActions),scopes,actionScopes:Object.freeze(actionScopes)});
};
const WORKSPACE_RESOURCES:Readonly<Record<string,readonly ResourcePolicy[]>>=Object.freeze({
 students:[record('student',['record.view','record.create','record.update','record.archive','record.restore','record.print'],['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ASSIGNED_STUDENT','ALL_WORKSPACE'],{'record.view':['SELF','CHILD_PERSONAL','ASSIGNED_STUDENT','ALL_WORKSPACE'],'record.create':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.update':['SELF','CHILD_PERSONAL','ASSIGNED_STUDENT','ALL_WORKSPACE'],'record.archive':['ASSIGNED_STUDENT','ALL_WORKSPACE'],'record.restore':['ASSIGNED_STUDENT','ALL_WORKSPACE'],'record.print':['SELF','CHILD_PERSONAL','ASSIGNED_STUDENT','ALL_WORKSPACE']})],staff:[record('staff',['record.view','record.create','record.update','record.archive','record.restore','record.print'],['SELF','ALL_WORKSPACE'],{'record.view':['SELF','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.update':['SELF','ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE'],'record.restore':['ALL_WORKSPACE'],'record.print':['SELF','ALL_WORKSPACE']}),record('teaching-assignment',['record.view','record.create','record.update','record.archive','record.restore'],['SELF','ALL_WORKSPACE'],{'record.view':['SELF','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.update':['ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE'],'record.restore':['ALL_WORKSPACE']})],classes:[record('class',['record.view','record.create','record.update','record.archive','record.restore'],['ASSIGNED_CLASS','ALL_WORKSPACE'],{'record.view':['ASSIGNED_CLASS','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.update':['ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE'],'record.restore':['ALL_WORKSPACE']})],sections:[record('section',['record.view','record.create','record.update','record.archive','record.restore'],['ASSIGNED_SECTION','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],{'record.view':['ASSIGNED_SECTION','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.update':['ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE'],'record.restore':['ALL_WORKSPACE']})],subjects:[record('subject',['record.view','record.create','record.update','record.archive'],['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],{'record.view':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.update':['ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE']})],users:[record('user',['record.view','users.manage'],all)],
 'academic-years':[record('academic-year',['record.view','record.create','record.update','record.archive'],['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],{'record.view':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.update':['ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE']})],attendance:[record('attendance-entry',['record.view','record.create','record.update','record.print','record.export','audit.view'],['SELF','CHILD_PERSONAL','ASSIGNED_SECTION','ALL_WORKSPACE'],{'record.view':['SELF','CHILD_PERSONAL','ASSIGNED_SECTION','ALL_WORKSPACE'],'record.create':['ASSIGNED_SECTION','ALL_WORKSPACE'],'record.update':['ASSIGNED_SECTION','ALL_WORKSPACE'],'record.print':['SELF','CHILD_PERSONAL','ASSIGNED_SECTION','ALL_WORKSPACE'],'record.export':['SELF','CHILD_PERSONAL','ASSIGNED_SECTION','ALL_WORKSPACE'],'audit.view':['ALL_WORKSPACE']})],timetable:[record('timetable-entry',['record.view','record.create','record.update','record.archive','record.print','record.export'],['CLASS','SECTION','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],{'record.view':['CLASS','SECTION','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.create':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.update':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.archive':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.print':['CLASS','SECTION','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.export':['CLASS','SECTION','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE']}),record('timetable-period',['record.view','record.create','record.update','record.archive'],['ALL_WORKSPACE'])],
 homework:[record('homework',[...records,'record.publish','record.unpublish','record.manage_audience','record.acknowledge'],scoped,{'record.view':['DIRECT_RECIPIENT','CHILD_RECIPIENT','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.create':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.update':['OWNED','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.publish':['OWNED','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.unpublish':['OWNED','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.manage_audience':['OWNED','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.acknowledge':['DIRECT_RECIPIENT','CHILD_RECIPIENT'],'record.print':['DIRECT_RECIPIENT','CHILD_RECIPIENT','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE']}),record('homework-acknowledgement',['record.view','record.acknowledge','acknowledgement.view_status'],['SELF','CHILD_PERSONAL','CHILD_RECIPIENT','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],{'record.view':['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.acknowledge':['SELF','CHILD_RECIPIENT'],'acknowledgement.view_status':['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE']})],
 'homework-acknowledgements':[record('homework-acknowledgement',['record.view','record.acknowledge','record.print','record.export'])],'teacher-work-log':[record('teacher-work-log')],
 'exams-results':[record('exam',['record.view','record.create','record.update','record.archive','assessment.publish_results','assessment.reopen_results'],['CLASS','SECTION','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],{'record.view':['CLASS','SECTION','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.create':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.update':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.archive':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'assessment.publish_results':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'assessment.reopen_results':['ALL_WORKSPACE']}),record('mark',['record.view','assessment.enter_marks','assessment.moderate','record.print','record.export','audit.view'],['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],{'record.view':['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'assessment.enter_marks':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'assessment.moderate':['ALL_WORKSPACE'],'record.print':['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.export':['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'audit.view':['ALL_WORKSPACE']}),record('report-card',['report.view','assessment.publish_results','record.print','report.export'],['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],{'report.view':['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'assessment.publish_results':['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'record.print':['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE'],'report.export':['SELF','CHILD_PERSONAL','ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE']})],
 'fees-payments':[
  record('fee-payment',['record.view','record.create','record.archive','record.print','record.export','audit.view'],['SELF','CHILD_PERSONAL','ALL_WORKSPACE'],{'record.view':['SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE'],'record.print':['SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'record.export':['SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'audit.view':['ALL_WORKSPACE']}),
  record('fee-structure',['record.view','record.create','record.update','record.archive'],['ALL_WORKSPACE']),
  record('fee-assignment',['record.view','record.create','record.archive'],['SELF','CHILD_PERSONAL','ALL_WORKSPACE'],{'record.view':['SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE']}),
  record('fee-correction',['record.view','record.create','workflow.review','workflow.approve','workflow.reject'],['ALL_WORKSPACE'])
 ],'leave-requests':[record('leave-request',['record.view','record.create','record.update','record.archive','record.print','record.export','attachment.view','attachment.download','attachment.upload','attachment.delete','audit.view','workflow.submit','workflow.review','workflow.approve','workflow.reject','workflow.return','workflow.cancel'],['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','DIRECT_ASSIGNED','ALL_WORKSPACE'],{'record.view':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','DIRECT_ASSIGNED','ALL_WORKSPACE'],'record.create':['SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'record.update':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'record.archive':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'record.print':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','DIRECT_ASSIGNED','ALL_WORKSPACE'],'record.export':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','DIRECT_ASSIGNED','ALL_WORKSPACE'],'attachment.view':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','DIRECT_ASSIGNED','ALL_WORKSPACE'],'attachment.download':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','DIRECT_ASSIGNED','ALL_WORKSPACE'],'attachment.upload':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'attachment.delete':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'audit.view':['ALL_WORKSPACE'],'workflow.submit':['SELF','CHILD_PERSONAL','ALL_WORKSPACE'],'workflow.review':['DIRECT_ASSIGNED','ALL_WORKSPACE'],'workflow.approve':['DIRECT_ASSIGNED','ALL_WORKSPACE'],'workflow.reject':['DIRECT_ASSIGNED','ALL_WORKSPACE'],'workflow.return':['DIRECT_ASSIGNED','ALL_WORKSPACE'],'workflow.cancel':['OWNED','CREATED_BY','SELF','CHILD_PERSONAL','ALL_WORKSPACE']})],
 notices:[record('notice',[...records,'record.publish','record.unpublish','record.manage_audience'])],'calendar-holidays':[record('calendar-holiday')],documents:[record('document',[...records,'record.publish','record.unpublish','record.manage_audience'])],certificates:[record('certificate')],uniform:[record('uniform')],curriculum:[record('curriculum')],'rules-regulations':[record('rule-regulation')],transport:[record('transport-route')],
 reports:[record('report',['report.view','report.create','report.share','report.export','record.print'])],workflows:[record('workflow',['record.view','workspace.configure','workflow.submit','workflow.review','workflow.approve','workflow.reject','workflow.return','workflow.cancel','audit.view'])],assets:[record('asset-category',['record.view','record.create','record.update','record.archive'],all),record('asset',['record.view','record.create','record.update','record.archive','record.print','record.export','audit.view'],all),record('asset-assignment',['record.view','record.create','record.update','record.archive','audit.view'],all),record('asset-maintenance',['record.view','record.create','record.update','record.archive','audit.view'],all)],idcards:[record('id-card-template',['record.view','record.create','record.update','record.archive'],all),record('digital-id-card',['record.view','record.create','record.update','record.archive','record.print','record.export','audit.view'],['SELF','ALL_WORKSPACE'],{'record.view':['SELF','ALL_WORKSPACE'],'record.create':['ALL_WORKSPACE'],'record.update':['ALL_WORKSPACE'],'record.archive':['ALL_WORKSPACE'],'record.print':['SELF','ALL_WORKSPACE'],'record.export':['SELF','ALL_WORKSPACE'],'audit.view':['ALL_WORKSPACE']})],
 access:[record('access-role',['access.roles.read','access.roles.manage','access.grants.manage','access.preview'],all),record('access-group',['access.groups.read','access.groups.manage','access.memberships.manage'],all),record('workspace-definition',['record.view','record.create','record.archive','record.restore','workspace.configure'],all),record('security-audit',['audit.security_view'],all)],
 school:[record('school-settings',['school.read','school.manage'],all)],portal:[record('portal-configuration',['portal.configure'],all),record('portal-profile',['record.view','record.update'],['SELF'])],diagnostics:[record('diagnostics',['diagnostics.view','diagnostics.export'],all)],imports:[record('school-import',['import.validate','import.execute'],all)]
});
const TEST_WORKSPACE_RESOURCES=new Map<string,readonly ResourcePolicy[]>();
export function registerTestWorkspaceManifest(workspaceKey:string,resources:readonly ResourcePolicy[]){
 if(process.env.NODE_ENV!=='test')throw new Error('Test workspace registration is available only in NODE_ENV=test.');
 if(WORKSPACE_RESOURCES[workspaceKey]||TEST_WORKSPACE_RESOURCES.has(workspaceKey))throw new Error('Workspace manifest already registered: '+workspaceKey);
 if(!workspaceKey||!resources.length)throw new Error('A test workspace manifest requires a key and at least one resource.');
 for(const resource of resources){if(!resource.resourceType||!resource.actions.length)throw new Error('Each resource requires a type and supported actions.');for(const action of resource.actions)if(!resource.actionScopes[action]?.length)throw new Error('Every supported action requires at least one scope: '+action)}
 TEST_WORKSPACE_RESOURCES.set(workspaceKey,Object.freeze([...resources]));return()=>TEST_WORKSPACE_RESOURCES.delete(workspaceKey);
}
export function registeredWorkspaceKeys(){return [...Object.keys(WORKSPACE_RESOURCES),...TEST_WORKSPACE_RESOURCES.keys()]}
export function workspaceManifest(workspaceKey:string):readonly ResourcePolicy[]{return TEST_WORKSPACE_RESOURCES.get(workspaceKey)||WORKSPACE_RESOURCES[workspaceKey]||[]}
export function resourcePolicy(workspaceKey:string,resourceType:string):ResourcePolicy|null{return workspaceManifest(workspaceKey).find(x=>x.resourceType===resourceType)||null}
export function scopesForAction(policy:ResourcePolicy,action:AuthorizationAction):readonly AuthorizationScope[]{return policy.actionScopes[action]||[]}
export function validateGrantDefinition(workspaceKey:string,resourceType:string,action:AuthorizationAction,scope:AuthorizationScope){const policy=resourcePolicy(workspaceKey,resourceType);return !!policy&&policy.actions.includes(action)&&scopesForAction(policy,action).includes(scope)}
const LEGACY_VISIBILITY:Readonly<Record<string,AuthorizationScope>>=Object.freeze({'View Own Records':'OWNED','View Assigned Records':'DIRECT_ASSIGNED','View Group Records':'GROUP','View Class Records':'CLASS','View Section Records':'SECTION','View Audience Records':'AUDIENCE','View All Workspace Records':'ALL_WORKSPACE'});
const LEGACY_ACTIONS:Readonly<Record<string,readonly AuthorizationAction[]>>=Object.freeze({'View Records':['record.view'],'Add Records':['record.create'],'Edit Records':['record.update'],'Delete Records':['record.archive'],'Permanent Delete Records':['record.permanent_delete'],'Print Records':['record.print'],'View Attachments':['attachment.view','attachment.download'],'Add Attachments':['attachment.upload'],'View Change Log':['audit.view']});
export type GrantDefinition=Readonly<{resourceType:string;action:AuthorizationAction;scope:AuthorizationScope;constraints:Readonly<Record<string,unknown>>}>;
export function legacyAccessSelectionToGrants(workspaceKey:string,selections:readonly string[]):GrantDefinition[]{
 const scopes=[...new Set(selections.map(x=>LEGACY_VISIBILITY[x]).filter((x):x is AuthorizationScope=>!!x))],actions=[...new Set(selections.flatMap(x=>LEGACY_ACTIONS[x]||[]))],out:GrantDefinition[]=[];
 for(const policy of workspaceManifest(workspaceKey))for(const action of actions)for(const scope of scopes)if(validateGrantDefinition(workspaceKey,policy.resourceType,action,scope))out.push(Object.freeze({resourceType:policy.resourceType,action,scope,constraints:Object.freeze({})}));
 return out;
}
const ROUTE_PREFIXES:Readonly<Record<string,readonly string[]>>=Object.freeze({students:['students'],staff:['staff'],classes:['classes'],sections:['sections'],subjects:['subjects'],users:['users'],'academic-years':['academic-years'],attendance:['attendance'],timetable:['timetable'],homework:['homework'],'homework-acknowledgements':['homework-acknowledgements'],'teacher-work-log':['teacherlog'],'exams-results':['exams','marks','reportcards'],'fees-payments':['fees'],'leave-requests':['leave'],notices:['notices'],'calendar-holidays':['calendar'],documents:['documents'],certificates:['certificates'],uniform:['uniform'],curriculum:['curriculum'],'rules-regulations':['rules'],transport:['transport'],assets:['assets'],idcards:['idcards']});
const ACTION_VERB:Readonly<Partial<Record<AuthorizationAction,string>>>=Object.freeze({'record.view':'view','record.create':'create','record.update':'update','record.archive':'delete','record.print':'print','record.publish':'publish','record.restore':'restore','student.deactivate':'deactivate'});
export function serverPermissionKeysForGrant(workspaceKey:string,resourceType:string,action:AuthorizationAction):string[]{
 const out=new Set<string>(),verb=ACTION_VERB[action];
 if(verb)for(const prefix of ROUTE_PREFIXES[workspaceKey]||[]){const key=prefix+':'+verb,contract=permissionContract(key);if(contract&&contract.resourceType===resourceType&&contract.action===action&&!contract.legacyAmbiguous)out.add(key)}
 for(const [permission,item] of Object.entries(explicit))if(item.workspaceKey===workspaceKey&&item.resourceType===resourceType&&item.action===action&&!item.legacyAmbiguous)out.add(permission);
 return [...out].sort();
}