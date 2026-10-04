import {scopesForAction,type AuthorizationAction,type AuthorizationScope} from './policy-registry.js';
import {resourceForTab,defaultTabForResource,tabsForResource} from './workspace-tab-resources.js';

export const UNIVERSAL_DASHBOARD_TAB_KEY='DASHBOARD' as const;
export const UNIVERSAL_TAB_KEYS=['MAIN','GRID_1','GRID_2','GRID_3'] as const;
export const UNIVERSAL_ROLE_TAB_KEYS=[UNIVERSAL_DASHBOARD_TAB_KEY,...UNIVERSAL_TAB_KEYS,'SPECIAL'] as const;
export const UNIVERSAL_NORMAL_PERMISSIONS=['VIEW','ADD','EDIT','DELETE','PRINT'] as const;
export const UNIVERSAL_SPECIAL_PERMISSIONS=[
 'WORKSPACE_ADMINISTRATOR','IMPORT_RECORDS','VIEW_CHANGE_LOG','VIEW_ARCHIVED_RECORDS','RESTORE_ARCHIVED_RECORDS',
 'PERMANENT_DELETE','VIEW_RECORDS_OWNED_BY_OTHERS','VIEW_ASSIGNED_RECORDS','ASSIGN_RECORDS','CHANGE_RECORD_OWNER',
 'PUBLISH','UNPUBLISH','ACKNOWLEDGE','SUBMIT','REVIEW','APPROVE','REJECT','RETURN','CANCEL','OVERRIDE_RECORD_LOCKS'
] as const;
export type UniversalTabKey=typeof UNIVERSAL_TAB_KEYS[number];
export type UniversalPermission={tabKey:UniversalTabKey|'DASHBOARD'|'SPECIAL';permissionKey:string};

export const UNIVERSAL_PERMISSION_DEFINITIONS=Object.freeze({
 dashboard:[{key:'VIEW',label:'View dashboard'}],
 normal:UNIVERSAL_NORMAL_PERMISSIONS.map(key=>({key,label:({VIEW:'View records',ADD:'Add records',EDIT:'Edit records',DELETE:'Delete records',PRINT:'Print records'} as Record<string,string>)[key]})),
 special:[
['WORKSPACE_ADMINISTRATOR','Workspace Administrator'],['IMPORT_RECORDS','Import Records'],['VIEW_CHANGE_LOG','View Change Log'],
  ['VIEW_ARCHIVED_RECORDS','View Archived Records'],['RESTORE_ARCHIVED_RECORDS','Restore Archived Records'],['PERMANENT_DELETE','Permanent Delete'],
  ['VIEW_RECORDS_OWNED_BY_OTHERS','View Records Owned by Others'],['VIEW_ASSIGNED_RECORDS','View Assigned Records'],
  ['ASSIGN_RECORDS','Assign Records'],['CHANGE_RECORD_OWNER','Change Record Owner'],['PUBLISH','Publish'],['UNPUBLISH','Unpublish'],
  ['ACKNOWLEDGE','Acknowledge'],['SUBMIT','Submit'],['REVIEW','Review'],['APPROVE','Approve'],['REJECT','Reject'],
  ['RETURN','Return'],['CANCEL','Cancel'],['OVERRIDE_RECORD_LOCKS','Override Record Locks']
 ].map(([key,label])=>({key,label}))
});

const DEFAULT_TABS=Object.freeze({MAIN:'Main Tab',GRID_1:'Grid Tab 1',GRID_2:'Grid Tab 2',GRID_3:'Grid Tab 3'});
const WORKSPACE_TABS:Readonly<Record<string,Readonly<Record<UniversalTabKey,string>>>>=Object.freeze({
 'exams-results':Object.freeze({MAIN:'Assessments',GRID_1:'Marks Entry',GRID_2:'Report Cards',GRID_3:'Co-scholastic'})
});
export function defaultWorkspaceTabs(workspaceKey:string):Record<UniversalTabKey,string>{return{...DEFAULT_TABS,...(WORKSPACE_TABS[workspaceKey]||{})}}

const NORMAL_ACTIONS:Readonly<Record<string,readonly AuthorizationAction[]>>=Object.freeze({VIEW:['record.view','report.view','submission.view'],ADD:['record.create','submission.create'],EDIT:['record.update','assessment.enter_marks','submission.update'],DELETE:['record.archive','submission.withdraw'],PRINT:['record.print','report.export']});
const SPECIAL_ACTIONS:Readonly<Record<string,readonly AuthorizationAction[]>>=Object.freeze({
IMPORT_RECORDS:['import.validate','import.execute'],VIEW_CHANGE_LOG:['audit.view'],RESTORE_ARCHIVED_RECORDS:['record.restore','record.unarchive'],
 PERMANENT_DELETE:['record.permanent_delete'],ASSIGN_RECORDS:['record.manage_assignees'],CHANGE_RECORD_OWNER:['record.transfer_ownership'],
 PUBLISH:['record.publish','assessment.publish_results'],UNPUBLISH:['record.unpublish','assessment.reopen_results'],
 ACKNOWLEDGE:['record.acknowledge'],SUBMIT:['workflow.submit','submission.create'],REVIEW:['workflow.review'],APPROVE:['workflow.approve'],
 REJECT:['workflow.reject'],RETURN:['workflow.return','submission.return'],CANCEL:['workflow.cancel','submission.withdraw'],
 OVERRIDE_RECORD_LOCKS:['record.override_locks','assessment.moderate']
});
const ACTION_PERMISSION=new Map<AuthorizationAction,string>();
for(const [permission,actions] of Object.entries(NORMAL_ACTIONS))for(const action of actions)ACTION_PERMISSION.set(action,permission);
for(const [permission,actions] of Object.entries(SPECIAL_ACTIONS))for(const action of actions)ACTION_PERMISSION.set(action,permission);

const personalScopes=new Set<AuthorizationScope>(['OWNED','CREATED_BY','SELF','DIRECT_RECIPIENT','CHILD_PERSONAL','CHILD_RECIPIENT','SCHOOL_PUBLISHED']);
const assignedScopes=new Set<AuthorizationScope>(['DIRECT_ASSIGNED','GROUP','CLASS','SECTION','AUDIENCE','CHILD_ASSIGNED','ASSIGNED_TEACHING_CONTEXT','ASSIGNED_CLASS','ASSIGNED_SECTION','ASSIGNED_STUDENT','CASE_ASSIGNED','DEPARTMENT','CLUB','HOUSE','ROUTE','HOSTEL']);
const creationActions=new Set<AuthorizationAction>(['record.create','import.validate','import.execute','submission.create']);

export type UniversalDerivedGrant={resourceType:string;action:AuthorizationAction;scope:AuthorizationScope;constraints:Record<string,unknown>};

function scopesForPermission(allowed:readonly AuthorizationScope[],action:AuthorizationAction,allRecords:boolean,assigned:boolean,workspaceAdmin:boolean){
 if((allRecords||workspaceAdmin)&&allowed.includes('ALL_WORKSPACE'))return['ALL_WORKSPACE'] as AuthorizationScope[];
 const scopes=allowed.filter(scope=>personalScopes.has(scope)||(assigned&&assignedScopes.has(scope)));
 if(scopes.length)return scopes;
 if(creationActions.has(action)&&allowed.includes('ALL_WORKSPACE'))return['ALL_WORKSPACE'] as AuthorizationScope[];
 return[] as AuthorizationScope[];
}

export function validateUniversalPermissions(items:readonly UniversalPermission[]){
 const tabs=new Set<string>(UNIVERSAL_ROLE_TAB_KEYS),normal=new Set<string>(UNIVERSAL_NORMAL_PERMISSIONS),special=new Set<string>(UNIVERSAL_SPECIAL_PERMISSIONS);
 for(const item of items)if(!tabs.has(item.tabKey)||(item.tabKey==='DASHBOARD'?item.permissionKey!=='VIEW':item.tabKey==='SPECIAL'?!special.has(item.permissionKey):!normal.has(item.permissionKey)))throw new Error('Invalid universal workspace permission: '+item.tabKey+' / '+item.permissionKey);
}

export function lifecyclePermissionSelected(selected:ReadonlySet<string>,tabKey:UniversalTabKey,action:'restore'|'permanentDelete'){
 if(action==='permanentDelete')return selected.has(tabKey+'|DELETE')&&selected.has('SPECIAL|PERMANENT_DELETE');
 return selected.has(tabKey+'|VIEW')&&selected.has('SPECIAL|VIEW_ARCHIVED_RECORDS')&&selected.has('SPECIAL|RESTORE_ARCHIVED_RECORDS');
}
function specialPrerequisite(permission:string,selected:Set<string>,tabKey:UniversalTabKey){const has=(key:string)=>selected.has(tabKey+'|'+key);if(permission==='RESTORE_ARCHIVED_RECORDS')return lifecyclePermissionSelected(selected,tabKey,'restore');if(permission==='IMPORT_RECORDS')return has('ADD')||has('EDIT');if(['PERMANENT_DELETE'].includes(permission))return has('DELETE');if(['ACKNOWLEDGE','VIEW_CHANGE_LOG'].includes(permission))return has('VIEW');return has('EDIT')}

export function universalPermissionsToGrants(workspaceKey:string,items:readonly UniversalPermission[]):UniversalDerivedGrant[]{
 validateUniversalPermissions(items);
 const selected=new Set(items.map(item=>item.tabKey+'|'+item.permissionKey)),out:UniversalDerivedGrant[]=[],seen=new Set<string>();
 const special=(key:string)=>selected.has('SPECIAL|'+key),workspaceAdmin=special('WORKSPACE_ADMINISTRATOR'),allRecords=workspaceAdmin||special('VIEW_RECORDS_OWNED_BY_OTHERS'),assigned=workspaceAdmin||special('VIEW_ASSIGNED_RECORDS'),viewArchived=workspaceAdmin||special('VIEW_ARCHIVED_RECORDS');
 const push=(tabKey:UniversalTabKey,action:AuthorizationAction)=>{
  const policy=resourceForTab(workspaceKey,tabKey);if(!policy||!policy.actions.includes(action))return;
  const scopes=scopesForPermission(scopesForAction(policy,action),action,allRecords,assigned,workspaceAdmin);
  for(const scope of scopes){const constraints={...(viewArchived?{viewArchived:true}:{}),tabKey};const key=[policy.resourceType,action,scope,tabKey].join('|');if(!seen.has(key)){seen.add(key);out.push({resourceType:policy.resourceType,action,scope,constraints})}}
 };
 UNIVERSAL_TAB_KEYS.forEach(tabKey=>{
  for(const [permission,actions] of Object.entries(NORMAL_ACTIONS))if(workspaceAdmin||selected.has(tabKey+'|'+permission))for(const action of actions)push(tabKey,action);
  for(const [permission,actions] of Object.entries(SPECIAL_ACTIONS)){const explicitLifecycle=['PERMANENT_DELETE','RESTORE_ARCHIVED_RECORDS'].includes(permission),permitted=(!explicitLifecycle&&workspaceAdmin)||(special(permission)&&specialPrerequisite(permission,selected,tabKey));if(permitted)for(const action of actions)push(tabKey,action)}
 });
 return out;
}

export function inferUniversalPermissions(workspaceKey:string,grants:readonly UniversalDerivedGrant[]):UniversalPermission[]{
 const out:UniversalPermission[]=[],seen=new Set<string>();
 const add=(tabKey:UniversalTabKey|'SPECIAL',permissionKey:string)=>{const key=tabKey+'|'+permissionKey;if(!seen.has(key)){seen.add(key);out.push({tabKey,permissionKey})}};
 for(const grant of grants){const served=tabsForResource(workspaceKey,grant.resourceType);if(!served.length)continue;const constrained=String(grant.constraints?.tabKey||''),tabKey=(UNIVERSAL_TAB_KEYS as readonly string[]).includes(constrained)?constrained as UniversalTabKey:defaultTabForResource(workspaceKey,grant.resourceType);const permission=ACTION_PERMISSION.get(grant.action);if(permission){if(Object.prototype.hasOwnProperty.call(NORMAL_ACTIONS,permission))add(tabKey,permission);else add('SPECIAL',permission)}if(grant.scope==='ALL_WORKSPACE')add('SPECIAL','VIEW_RECORDS_OWNED_BY_OTHERS');if(assignedScopes.has(grant.scope))add('SPECIAL','VIEW_ASSIGNED_RECORDS');if(grant.constraints?.viewArchived===true)add('SPECIAL','VIEW_ARCHIVED_RECORDS')}
 return out;
}
