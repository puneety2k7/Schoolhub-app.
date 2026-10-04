import {lifecycleRoleSelections} from './lifecycle-permissions.js';
import type { Queryable } from '../database/types.js';
import { ApiError } from '../errors/api-error.js';
import type { Principal } from './service.js';
import { permissionContract,workspaceManifest,type AuthorizationAction,type AuthorizationScope } from './policy-registry.js';
import {universalPermissionsToGrants,type UniversalPermission} from './universal-workspace-permissions.js';

export type GrantConstraints=Readonly<{
  viewDrafts?:boolean;viewArchived?:boolean;viewDeleted?:boolean;viewHistoricalYears?:boolean;
  viewConfidential?:boolean;viewInternalNotes?:boolean;historicalAccess?:boolean;
  readableFields?:readonly string[];writableFields?:readonly string[];
  tabKey?:'MAIN'|'GRID_1'|'GRID_2'|'GRID_3';
}>;

export type EffectiveGrant=Readonly<{
  workspaceKey:string;resourceType:string;action:AuthorizationAction;scope:AuthorizationScope;
  constraints:GrantConstraints;groupId:string;groupName:string;roleId:string|null;roleName:string|null;
  provenance:'normalized'|'legacy-role';
}>;

export type RecordSecurityContext=Readonly<{
  schoolId:string;workspaceKey:string;resourceType:string;recordId?:string;
  ownerUserId?:string|null;createdByUserId?:string|null;subjectUserIds?:readonly string[];
  subjectStudentIds?:readonly string[];subjectStaffIds?:readonly string[];recipientUserIds?:readonly string[];recipientStudentIds?:readonly string[];
  assignedUserIds?:readonly string[];audienceGroupIds?:readonly string[];audienceType?:string|null;
  academicYearId?:string|null;classId?:string|null;sectionId?:string|null;subjectId?:string|null;
  lifecycle?:string|null;sensitivity?:string|null;published?:boolean;internalNotes?:boolean;
  tabKey?:'MAIN'|'GRID_1'|'GRID_2'|'GRID_3';
}>;

import {defaultTabForResource,type WorkspaceTabKey} from './workspace-tab-resources.js';
export {defaultTabForResource,type WorkspaceTabKey};
export function grantAppliesToTab(grant:Pick<EffectiveGrant,'constraints'>,tabKey:WorkspaceTabKey,resourceDefaultTab:WorkspaceTabKey='MAIN'){return grant.constraints.tabKey?grant.constraints.tabKey===tabKey:tabKey===resourceDefaultTab}

type RelationshipContext={
  groupIds:Set<string>;classIds:Set<string>;sectionIds:Set<string>;childStudentIds:Set<string>;
  assignments:Array<{academicYearId:string|null;classId:string;sectionId:string|null;subjectId:string|null}>;
};

const visibilityRoles:Readonly<Record<string,AuthorizationScope>>=Object.freeze({
  'View Own Records':'OWNED','View Assigned Records':'DIRECT_ASSIGNED','View Group Records':'GROUP',
  'View Class Records':'CLASS','View Section Records':'SECTION','View Audience Records':'AUDIENCE',
  'View All Workspace Records':'ALL_WORKSPACE'
});

const actionRoles:Readonly<Record<string,readonly AuthorizationAction[]>>=Object.freeze({
  'View Records':['record.view'],'Add Records':['record.create'],'Edit Records':['record.update'],
  'Delete Records':['record.archive'],'Permanent Delete Records':['record.permanent_delete'],
  'Print Records':['record.print'],'View Attachments':['attachment.view','attachment.download'],
  'Add Attachments':['attachment.upload'],'View Change Log':['audit.view']
});

function deny(code='AUTHORIZATION_DENIED',details?:unknown):never{throw new ApiError(code,'Access is denied.',403,details)}
function unique<T>(items:T[]){return [...new Set(items)]}

export const LEGACY_RUNTIME_AUTHORIZATION_ENABLED=false as const;

export async function resolveEffectiveGrants(db:Queryable,p:Principal,workspaceKey:string,resourceType:string,tabKey?:WorkspaceTabKey):Promise<EffectiveGrant[]>{
  const workspace=(await db.query<any>("SELECT id FROM workspace_definitions WHERE school_id=$1 AND workspace_key=$2 AND status<>'Archived'",[p.schoolId,workspaceKey])).rows[0];
  if(!workspace)return[];
  const [grantRows,universalRows]=await Promise.all([
    db.query<any>(`SELECT g.id AS "groupId",g.name AS "groupName",ar.id AS "roleId",ar.name AS "roleName",arg.resource_type AS "resourceType",arg.action_key AS action,arg.scope_key AS scope,arg.constraints
      FROM access_group_memberships gm JOIN access_groups g ON g.id=gm.group_id AND g.school_id=gm.school_id AND g.active=true
      JOIN access_group_roles agr ON agr.group_id=g.id AND agr.school_id=g.school_id
      JOIN access_roles ar ON ar.id=agr.role_id AND ar.school_id=g.school_id AND ar.status='Active' AND ar.workspace_id=$3
      JOIN access_role_grants arg ON arg.role_id=ar.id AND arg.school_id=ar.school_id
      WHERE gm.school_id=$1 AND gm.user_id=$2 AND arg.resource_type=$4`,[p.schoolId,p.userId,workspace.id,resourceType]),
    db.query<any>(`SELECT g.id AS "groupId",g.name AS "groupName",ar.id AS "roleId",ar.name AS "roleName",urp.tab_key AS "tabKey",urp.permission_key AS "permissionKey"
      FROM access_group_memberships gm JOIN access_groups g ON g.id=gm.group_id AND g.school_id=gm.school_id AND g.active=true
      JOIN access_group_roles agr ON agr.group_id=g.id AND agr.school_id=g.school_id
      JOIN access_roles ar ON ar.id=agr.role_id AND ar.school_id=g.school_id AND ar.status='Active' AND ar.workspace_id=$3
      JOIN access_role_universal_permissions urp ON urp.role_id=ar.id AND urp.school_id=ar.school_id
      WHERE gm.school_id=$1 AND gm.user_id=$2`,[p.schoolId,p.userId,workspace.id])
  ]);
  const universalRoleIds=new Set(universalRows.rows.map((row:any)=>row.roleId)),normalized=grantRows.rows.filter((row:any)=>!universalRoleIds.has(row.roleId)).map((row:any)=>Object.freeze({workspaceKey,resourceType:row.resourceType,action:row.action as AuthorizationAction,scope:row.scope as AuthorizationScope,constraints:Object.freeze(row.constraints||{}),groupId:row.groupId,groupName:row.groupName,roleId:row.roleId,roleName:row.roleName,provenance:'normalized' as const})),buckets=new Map<string,{groupId:string;groupName:string;roleId:string;roleName:string;items:UniversalPermission[]}>();
  for(const row of universalRows.rows){const key=row.groupId+'|'+row.roleId,bucket=buckets.get(key)||{groupId:String(row.groupId),groupName:String(row.groupName),roleId:String(row.roleId),roleName:String(row.roleName),items:[] as UniversalPermission[]};bucket.items.push({tabKey:row.tabKey,permissionKey:row.permissionKey});buckets.set(key,bucket)}
  const universal:EffectiveGrant[]=[];
  for(const bucket of buckets.values())for(const grant of universalPermissionsToGrants(workspaceKey,bucket.items))if(grant.resourceType===resourceType)universal.push(Object.freeze({workspaceKey,resourceType:grant.resourceType,action:grant.action,scope:grant.scope,constraints:Object.freeze(grant.constraints||{}),groupId:bucket.groupId,groupName:bucket.groupName,roleId:bucket.roleId,roleName:bucket.roleName,provenance:'normalized' as const}));
  const out=[...normalized,...universal],seen=new Set<string>(),defaultTab=defaultTabForResource(workspaceKey,resourceType),requestedTab=tabKey||defaultTab;
  return out.filter(grant=>{const key=[grant.action,grant.scope,grant.groupId,grant.roleId||'',JSON.stringify(grant.constraints)].join('|');if(seen.has(key))return false;seen.add(key);return true}).filter(grant=>grantAppliesToTab(grant,requestedTab,defaultTab));
}

async function relationships(db:Queryable,p:Principal):Promise<RelationshipContext>{
  const [groups,assignments,student,children]=await Promise.all([
    db.query<any>('SELECT gm.group_id AS id FROM access_group_memberships gm JOIN access_groups g ON g.id=gm.group_id AND g.school_id=gm.school_id WHERE gm.school_id=$1 AND gm.user_id=$2 AND g.active=true',[p.schoolId,p.userId]),
    p.teacherId?db.query<any>('SELECT academic_year_id AS "academicYearId",class_id AS "classId",section_id AS "sectionId",subject_id AS "subjectId" FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$2 AND active=true AND (valid_from IS NULL OR valid_from<=CURRENT_DATE) AND (valid_until IS NULL OR valid_until>=CURRENT_DATE)',[p.schoolId,p.teacherId]):Promise.resolve({rows:[]}),
    p.studentId?db.query<any>("SELECT class_id AS \"classId\",section_id AS \"sectionId\" FROM students WHERE school_id=$1 AND id=$2 AND status='Active'",[p.schoolId,p.studentId]):Promise.resolve({rows:[]}),
    p.guardianId?db.query<any>("SELECT s.id,s.class_id AS \"classId\",s.section_id AS \"sectionId\" FROM guardian_student_links gsl JOIN students s ON s.id=gsl.student_id AND s.school_id=gsl.school_id WHERE gsl.school_id=$1 AND gsl.guardian_id=$2 AND gsl.active=true AND s.status='Active'",[p.schoolId,p.guardianId]):Promise.resolve({rows:[]})
  ]);
  const classIds=new Set<string>(),sectionIds=new Set<string>();
  for(const row of [...assignments.rows,...student.rows,...children.rows]){if(row.classId)classIds.add(row.classId);if(row.sectionId)sectionIds.add(row.sectionId)}
  return{groupIds:new Set(groups.rows.map((x:any)=>x.id)),classIds,sectionIds,childStudentIds:new Set(children.rows.map((x:any)=>x.id)),assignments:assignments.rows};
}

function lifecycleAllowed(grant:EffectiveGrant,record:RecordSecurityContext,action?:AuthorizationAction){
  const state=String(record.lifecycle||'').toLowerCase();
  if(state==='draft'&&!grant.constraints.viewDrafts&&!['OWNED','CREATED_BY','DIRECT_ASSIGNED','ASSIGNED_TEACHING_CONTEXT'].includes(grant.scope))return false;
  if(state==='archived'&&action!=='record.permanent_delete'&&!grant.constraints.viewArchived)return false;
  if(state==='deleted'&&!grant.constraints.viewDeleted)return false;
  if(String(record.sensitivity||'').toLowerCase()==='confidential'&&!grant.constraints.viewConfidential)return false;
  if(record.internalNotes&&!grant.constraints.viewInternalNotes)return false;
  return true;
}

function teachingMatch(assignments:RelationshipContext['assignments'],record:RecordSecurityContext){return assignments.some(a=>a.classId===record.classId&&(!record.sectionId?!a.sectionId||a.sectionId===null:!a.sectionId||a.sectionId===record.sectionId)&&(!record.subjectId?!a.subjectId||a.subjectId===null:!a.subjectId||a.subjectId===record.subjectId)&&(!record.academicYearId?!a.academicYearId||a.academicYearId===null:!a.academicYearId||a.academicYearId===record.academicYearId))}
function intersects(a:readonly string[]|undefined,b:Set<string>){return !!a?.some(x=>b.has(x))}

export function grantMatches(grant:EffectiveGrant,p:Principal,record:RecordSecurityContext,rel:RelationshipContext,action?:AuthorizationAction){
  if(record.schoolId!==p.schoolId||grant.workspaceKey!==record.workspaceKey||grant.resourceType!==record.resourceType||!grantAppliesToTab(grant,record.tabKey||defaultTabForResource(record.workspaceKey,record.resourceType),defaultTabForResource(record.workspaceKey,record.resourceType))||!lifecycleAllowed(grant,record,action))return false;
  switch(grant.scope){
   case'ALL_WORKSPACE':return true;
   case'OWNED':return record.ownerUserId===p.userId;
   case'CREATED_BY':return record.createdByUserId===p.userId;
   case'SELF':return !!(record.subjectUserIds?.includes(p.userId)||(p.studentId&&record.subjectStudentIds?.includes(p.studentId))||(p.teacherId&&record.subjectStaffIds?.includes(p.teacherId)));
   case'DIRECT_ASSIGNED':return !!record.assignedUserIds?.includes(p.userId);
   case'DIRECT_RECIPIENT':return !!(record.recipientUserIds?.includes(p.userId)||(p.studentId&&record.recipientStudentIds?.includes(p.studentId)));
   case'GROUP':return record.audienceType==='GROUP'&&intersects(record.audienceGroupIds,rel.groupIds);
   case'CLASS':return record.audienceType==='CLASS'&&!!record.classId&&rel.classIds.has(record.classId);
   case'SECTION':return record.audienceType==='SECTION'&&!!record.sectionId&&rel.sectionIds.has(record.sectionId);
   case'AUDIENCE':return !!(record.recipientUserIds?.includes(p.userId)||intersects(record.audienceGroupIds,rel.groupIds)||(record.audienceType==='CLASS'&&record.classId&&rel.classIds.has(record.classId))||(record.audienceType==='SECTION'&&record.sectionId&&rel.sectionIds.has(record.sectionId)));
   case'CHILD_PERSONAL':return intersects(record.subjectStudentIds,rel.childStudentIds);
   case'CHILD_ASSIGNED':return intersects(record.subjectStudentIds,rel.childStudentIds)&&!!record.assignedUserIds?.length;
   case'CHILD_RECIPIENT':return intersects(record.recipientStudentIds,rel.childStudentIds);
   case'ASSIGNED_TEACHING_CONTEXT':return teachingMatch(rel.assignments,record);
   case'ASSIGNED_CLASS':return !!record.classId&&rel.assignments.some(a=>a.classId===record.classId);
   case'ASSIGNED_SECTION':return !!record.sectionId&&rel.assignments.some(a=>a.sectionId===record.sectionId);
   case'ASSIGNED_STUDENT':return !!record.subjectStudentIds?.length&&teachingMatch(rel.assignments,record);
   case'SCHOOL_PUBLISHED':return record.published===true&&record.audienceType==='SCHOOL_PUBLISHED';
   default:return false;
  }
}

async function decision(db:Queryable,p:Principal,action:AuthorizationAction,record:RecordSecurityContext){
  if(record.schoolId!==p.schoolId)return{allowed:false,grants:[],reason:'TENANT_MISMATCH'};
  if(p.systemRecovery===true)return{allowed:true,grants:[],reason:'SYSTEM_RECOVERY_AUTHORITY'};
  const grants=await resolveEffectiveGrants(db,p,record.workspaceKey,record.resourceType,record.tabKey),rel=await relationships(db,p),eligible=action==='record.restore'||action==='record.unarchive'||action==='record.permanent_delete'?await lifecycleRoleSelections(db,p,record.workspaceKey,record.tabKey||defaultTabForResource(record.workspaceKey,record.resourceType),action==='record.permanent_delete'?'permanentDelete':'restore'):null,matched=grants.filter(g=>g.action===action&&grantMatches(g,p,record,rel,action)&&(!eligible||eligible.some(role=>role.roleId===g.roleId&&role.groupId===g.groupId)));
  return{allowed:matched.length>0,grants:matched,reason:matched.length?'MATCHED_COMPLETE_GRANT':'NO_COMPLETE_GRANT'};
}

export async function authorizeRecord(db:Queryable,p:Principal,action:AuthorizationAction,record:RecordSecurityContext){
  const result=await decision(db,p,action,record);if(!result.allowed)deny('AUTHORIZATION_DENIED',{workspaceKey:record.workspaceKey,resourceType:record.resourceType,action,reason:result.reason});
  if(action!=='record.view'&&action!=='report.view'&&action!=='record.create'&&action!=='record.permanent_delete'){const visible=await decision(db,p,'record.view',record);if(!visible.allowed)deny('RECORD_VISIBILITY_REQUIRED',{workspaceKey:record.workspaceKey,resourceType:record.resourceType,action})}
  return result;
}
export async function authorizeArchivedLifecycle(db:Queryable,p:Principal,action:'record.restore'|'record.permanent_delete',record:RecordSecurityContext){
 if(record.schoolId!==p.schoolId)deny('TENANT_MISMATCH');
 if(record.lifecycle!=='Archived')throw new ApiError('INVALID_LIFECYCLE_TRANSITION','The record must be archived before this operation.',409);
 return authorizeRecord(db,p,action,record);
}
export async function authorizeCreate(db:Queryable,p:Principal,record:RecordSecurityContext){return authorizeRecord(db,p,'record.create',record)}
export async function authorizeUpdate(db:Queryable,p:Principal,current:RecordSecurityContext,next:RecordSecurityContext){
  for(const key of ['schoolId','workspaceKey','resourceType'] as const)if(current[key]!==next[key])deny('SECURITY_CONTEXT_CHANGE_REQUIRES_EXPLICIT_ACTION',{field:key});
  await authorizeRecord(db,p,'record.update',current);return authorizeRecord(db,p,'record.update',next);
}
export function projectReadableFields<T extends Record<string,unknown>>(record:T,grants:readonly EffectiveGrant[],baseline:readonly string[]){const allowed=new Set(baseline);for(const grant of grants)for(const field of grant.constraints.readableFields||[])allowed.add(field);return Object.fromEntries(Object.entries(record).filter(([key])=>allowed.has(key))) as Partial<T>}
export function validateWritableFields(input:Record<string,unknown>,grants:readonly EffectiveGrant[],baseline:readonly string[]){const allowed=new Set(baseline);for(const grant of grants)for(const field of grant.constraints.writableFields||[])allowed.add(field);const denied=Object.keys(input).filter(key=>!allowed.has(key));if(denied.length)deny('FIELD_WRITE_DENIED',{fields:denied});return input}
export async function getCapabilities(db:Queryable,p:Principal,record:RecordSecurityContext,actions:readonly AuthorizationAction[]){const out:Record<string,boolean>={};for(const action of actions)out[action]=(await decision(db,p,action,record)).allowed;return out}
export function permissionPolicy(permission:string){const contract=permissionContract(permission);if(!contract)deny('UNREGISTERED_PERMISSION',{permission});return contract}


export async function authorizeWorkspaceAction(db:Queryable,p:Principal,workspaceKey:string,resourceType:string,action:AuthorizationAction,tabKey?:WorkspaceTabKey){
 if(p.systemRecovery===true)return{allowed:true,grants:[] as EffectiveGrant[],reason:'SYSTEM_RECOVERY_AUTHORITY'};
 const grants=(await resolveEffectiveGrants(db,p,workspaceKey,resourceType,tabKey)).filter(grant=>grant.action===action);
 if(!grants.length)deny('AUTHORIZATION_DENIED',{workspaceKey,resourceType,action,reason:'NO_COMPLETE_GRANT'});
 return{allowed:true,grants,reason:'MATCHED_COMPLETE_GRANT'};
}
export async function getWorkspaceCapabilities(db:Queryable,p:Principal,workspaceKey:string,resourceType:string,actions:readonly AuthorizationAction[],tabKey?:WorkspaceTabKey){
 if(p.systemRecovery===true)return Object.fromEntries(actions.map(action=>[action,true])) as Record<string,boolean>;
 const grants=await resolveEffectiveGrants(db,p,workspaceKey,resourceType,tabKey),out:Record<string,boolean>={};for(const action of actions)out[action]=grants.some(grant=>grant.action===action);return out;
}