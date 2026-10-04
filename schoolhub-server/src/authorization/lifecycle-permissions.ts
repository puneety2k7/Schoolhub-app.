import type {Queryable} from '../database/types.js';
import type {Principal} from './service.js';
import {ApiError} from '../errors/api-error.js';
import {lifecyclePermissionSelected,type UniversalTabKey} from './universal-workspace-permissions.js';

export type LifecycleOperation='restore'|'permanentDelete';
export type RoleSelection={roleId:string;groupId:string;items:Set<string>};
export async function lifecycleRoleSelections(db:Queryable,p:Principal,workspaceKey:string,tabKey:UniversalTabKey,operation:LifecycleOperation):Promise<RoleSelection[]>{
 const rows=(await db.query<any>(`SELECT ar.id AS "roleId",g.id AS "groupId",up.tab_key AS "tabKey",up.permission_key AS "permissionKey"
 FROM access_group_memberships gm
 JOIN access_groups g ON g.id=gm.group_id AND g.school_id=gm.school_id AND g.active=true
 JOIN access_group_roles agr ON agr.group_id=g.id AND agr.school_id=g.school_id
 JOIN access_roles ar ON ar.id=agr.role_id AND ar.school_id=g.school_id AND ar.status='Active'
 JOIN workspace_definitions w ON w.id=ar.workspace_id AND w.school_id=ar.school_id AND w.status<>'Archived'
 JOIN access_role_universal_permissions up ON up.role_id=ar.id AND up.school_id=ar.school_id
 WHERE gm.school_id=$1 AND gm.user_id=$2 AND w.workspace_key=$3`,[p.schoolId,p.userId,workspaceKey])).rows;
 const roles=new Map<string,RoleSelection>();
 for(const row of rows){const key=row.groupId+'|'+row.roleId,role=roles.get(key)||{roleId:row.roleId,groupId:row.groupId,items:new Set<string>()};role.items.add(row.tabKey+'|'+row.permissionKey);roles.set(key,role)}
 return [...roles.values()].filter(role=>lifecyclePermissionSelected(role.items,tabKey,operation));
}
export async function requireLifecycleSelections(db:Queryable,p:Principal,workspaceKey:string,tabKey:UniversalTabKey,operation:LifecycleOperation){
 if(p.systemRecovery===true)return [];
 const roles=await lifecycleRoleSelections(db,p,workspaceKey,tabKey,operation);
 if(!roles.length)throw new ApiError('LIFECYCLE_PERMISSION_REQUIRED','The explicit tab and special lifecycle permissions are required.',403,{workspaceKey,tabKey,operation});
 return roles;
}
