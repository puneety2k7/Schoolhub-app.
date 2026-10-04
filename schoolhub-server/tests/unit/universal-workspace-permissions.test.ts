import {describe,expect,it} from 'vitest';
import {UNIVERSAL_PERMISSION_DEFINITIONS,UNIVERSAL_SPECIAL_PERMISSIONS,UNIVERSAL_TAB_KEYS,defaultWorkspaceTabs,inferUniversalPermissions,universalPermissionsToGrants,validateUniversalPermissions} from '../../src/authorization/universal-workspace-permissions.js';

describe('universal workspace permissions',()=>{
 it('defines the standard 41 permission selections including Dashboard View',()=>{
  expect(UNIVERSAL_PERMISSION_DEFINITIONS.dashboard).toEqual([{key:'VIEW',label:'View dashboard'}]);
  expect(1+UNIVERSAL_TAB_KEYS.length*UNIVERSAL_PERMISSION_DEFINITIONS.normal.length+UNIVERSAL_SPECIAL_PERMISSIONS.length).toBe(41);
  expect(()=>validateUniversalPermissions([{tabKey:'DASHBOARD',permissionKey:'VIEW'}])).not.toThrow();
  expect(()=>validateUniversalPermissions([{tabKey:'DASHBOARD',permissionKey:'EDIT'}])).toThrow();
 });
 it('uses four stable tab keys with editable display defaults',()=>{
  expect(defaultWorkspaceTabs('attendance')).toEqual({MAIN:'Main Tab',GRID_1:'Grid Tab 1',GRID_2:'Grid Tab 2',GRID_3:'Grid Tab 3'});
  expect(defaultWorkspaceTabs('exams-results')).toEqual({MAIN:'Assessments',GRID_1:'Marks Entry',GRID_2:'Report Cards',GRID_3:'Co-scholastic'});
 });
 it('keeps View Records owner-scoped until View Records Owned by Others is selected',()=>{
  const owned=universalPermissionsToGrants('attendance',[{tabKey:'MAIN',permissionKey:'VIEW'}]);
  expect(owned.some(grant=>grant.action==='record.view'&&grant.scope==='ALL_WORKSPACE')).toBe(false);
  const all=universalPermissionsToGrants('attendance',[{tabKey:'MAIN',permissionKey:'VIEW'},{tabKey:'SPECIAL',permissionKey:'VIEW_RECORDS_OWNED_BY_OTHERS'}]);
  expect(all.some(grant=>grant.action==='record.view'&&grant.scope==='ALL_WORKSPACE')).toBe(true);
 });
 it('maps Exams tab permissions to the actual backend resources and actions',()=>{
  const grants=universalPermissionsToGrants('exams-results',[
   {tabKey:'GRID_1',permissionKey:'EDIT'},
   {tabKey:'GRID_2',permissionKey:'VIEW'},
   {tabKey:'SPECIAL',permissionKey:'VIEW_RECORDS_OWNED_BY_OTHERS'}
  ]);
  expect(grants.some(grant=>grant.resourceType==='mark'&&grant.action==='assessment.enter_marks')).toBe(true);
  expect(grants.some(grant=>grant.resourceType==='report-card'&&grant.action==='report.view')).toBe(true);
  const inferred=inferUniversalPermissions('exams-results',grants);
  expect(inferred).toContainEqual({tabKey:'GRID_1',permissionKey:'EDIT'});
  expect(inferred).toContainEqual({tabKey:'GRID_2',permissionKey:'VIEW'});
 });
 it('keeps four tab permissions separate when a workspace has one backend resource',()=>{
  const grants=universalPermissionsToGrants('students',[{tabKey:'GRID_1',permissionKey:'VIEW'}]);
  expect(grants.some(grant=>grant.resourceType==='student'&&grant.action==='record.view'&&grant.constraints.tabKey==='GRID_1')).toBe(true);
  expect(grants.some(grant=>grant.constraints.tabKey==='MAIN')).toBe(false);
  expect(inferUniversalPermissions('students',grants)).toContainEqual({tabKey:'GRID_1',permissionKey:'VIEW'});
 });
 it('requires the matching normal permission before granting a special action',()=>{
  expect(universalPermissionsToGrants('homework',[{tabKey:'SPECIAL',permissionKey:'PUBLISH'}])).toEqual([]);
  const grants=universalPermissionsToGrants('homework',[{tabKey:'MAIN',permissionKey:'EDIT'},{tabKey:'SPECIAL',permissionKey:'PUBLISH'},{tabKey:'SPECIAL',permissionKey:'VIEW_RECORDS_OWNED_BY_OTHERS'}]);
  expect(grants.some(grant=>grant.action==='record.publish')).toBe(true);
 });
 it('preserves Workspace Administrator authority except explicit lifecycle capabilities',()=>{
  const grants=universalPermissionsToGrants('homework',[{tabKey:'SPECIAL',permissionKey:'WORKSPACE_ADMINISTRATOR'}]);
  expect(grants.some(grant=>grant.action==='record.view'&&grant.scope==='ALL_WORKSPACE')).toBe(true);
  expect(grants.some(grant=>grant.action==='record.update'&&grant.scope==='ALL_WORKSPACE')).toBe(true);
  expect(grants.some(grant=>grant.action==='record.permanent_delete'&&grant.scope==='ALL_WORKSPACE')).toBe(false);
 });
});
