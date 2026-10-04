import {describe,it,expect} from 'vitest';
import {lifecyclePermissionSelected,universalPermissionsToGrants,type UniversalPermission} from '../../src/authorization/universal-workspace-permissions.js';
import {requireLifecycleSelections} from '../../src/authorization/lifecycle-permissions.js';
import {grantMatches,type EffectiveGrant} from '../../src/authorization/policy-engine.js';
import type {Principal} from '../../src/authorization/service.js';

const p={schoolId:'school',userId:'user',roleId:'account-role',roleName:'User',teacherId:null,permissions:[],username:'user'} as Principal;
const restore:UniversalPermission[]=[{tabKey:'MAIN',permissionKey:'VIEW'},{tabKey:'SPECIAL',permissionKey:'VIEW_ARCHIVED_RECORDS'},{tabKey:'SPECIAL',permissionKey:'RESTORE_ARCHIVED_RECORDS'},{tabKey:'SPECIAL',permissionKey:'VIEW_RECORDS_OWNED_BY_OTHERS'}];
describe('explicit lifecycle authorization',()=>{
 it('allows restore without EDIT, and requires every explicit selection',()=>{
  expect(universalPermissionsToGrants('homework',restore).some(g=>g.action==='record.restore')).toBe(true);
  for(const missing of restore.slice(0,3)){
   const items=restore.filter(item=>item!==missing);
   items.push({tabKey:'SPECIAL',permissionKey:'WORKSPACE_ADMINISTRATOR'});
   expect(universalPermissionsToGrants('homework',items).some(g=>g.action==='record.restore')).toBe(false);
  }
 });
 it('does not leak VIEW or DELETE between tabs',()=>{
  const selections=new Set(['GRID_1|VIEW','GRID_1|DELETE','SPECIAL|VIEW_ARCHIVED_RECORDS','SPECIAL|RESTORE_ARCHIVED_RECORDS','SPECIAL|PERMANENT_DELETE']);
  expect(lifecyclePermissionSelected(selections,'GRID_1','restore')).toBe(true);
  expect(lifecyclePermissionSelected(selections,'GRID_2','restore')).toBe(false);
  expect(lifecyclePermissionSelected(selections,'GRID_2','permanentDelete')).toBe(false);
 });
 it('requires explicit DELETE and PERMANENT_DELETE even with Workspace Administrator',()=>{
  const admin:UniversalPermission={tabKey:'SPECIAL',permissionKey:'WORKSPACE_ADMINISTRATOR'};
  const del:UniversalPermission={tabKey:'MAIN',permissionKey:'DELETE'};
  const permanent:UniversalPermission={tabKey:'SPECIAL',permissionKey:'PERMANENT_DELETE'};
  for(const items of [[admin],[admin,del],[admin,permanent]])expect(universalPermissionsToGrants('homework',items).some(g=>g.action==='record.permanent_delete')).toBe(false);
  expect(universalPermissionsToGrants('homework',[admin,del,permanent]).some(g=>g.action==='record.permanent_delete')).toBe(true);
 });
 it('does not combine incomplete role selections into a lifecycle grant',async()=>{
  const rows=restore.map((item,index)=>({...item,roleId:index===0?'first':'second',groupId:'group'}));
  const db:any={query:async()=>({rows})};
  await expect(requireLifecycleSelections(db,p,'homework','MAIN','restore')).rejects.toMatchObject({code:'LIFECYCLE_PERMISSION_REQUIRED'});
  rows.forEach(row=>row.roleId='first');
  expect(await requireLifecycleSelections(db,p,'homework','MAIN','restore')).toHaveLength(1);
  rows.splice(0,1);
  await expect(requireLifecycleSelections(db,p,'homework','MAIN','restore')).rejects.toMatchObject({code:'LIFECYCLE_PERMISSION_REQUIRED'});
 });
 it('allows permanent-delete scope evaluation on an archived record without adding Restore permissions',()=>{
  const grant={workspaceKey:'homework',resourceType:'homework',action:'record.permanent_delete',scope:'ALL_WORKSPACE',constraints:{tabKey:'MAIN'},groupId:'group',groupName:'Group',roleId:'role',roleName:'Role',provenance:'normalized'} as EffectiveGrant;
  const record={schoolId:'school',workspaceKey:'homework',resourceType:'homework',recordId:'record',lifecycle:'Archived',tabKey:'MAIN'} as const,relationships={groupIds:new Set(),classIds:new Set(),sectionIds:new Set(),childStudentIds:new Set(),assignments:[]};
  expect(grantMatches(grant,p,record,relationships as any,'record.permanent_delete')).toBe(true);
  expect(grantMatches(grant,p,record,relationships as any)).toBe(false);
 });
 it('System Administrator needs no stored permission selections',async()=>{
  const db:any={query:async()=>{throw new Error('Must not query stored selections')}};
  await expect(requireLifecycleSelections(db,{...p,systemRecovery:true},'homework','MAIN','restore')).resolves.toEqual([]);
  await expect(requireLifecycleSelections(db,{...p,systemRecovery:true},'homework','MAIN','permanentDelete')).resolves.toEqual([]);
 });
});
