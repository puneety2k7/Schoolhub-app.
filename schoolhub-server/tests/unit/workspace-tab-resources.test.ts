import {describe,expect,it} from 'vitest';
import {registeredWorkspaceKeys,workspaceManifest} from '../../src/authorization/policy-registry.js';
import {MULTI_RESOURCE_TAB_RESOURCES,WORKSPACE_TAB_KEYS,defaultTabForResource,resourceForTab,tabsForResource} from '../../src/authorization/workspace-tab-resources.js';
import {universalPermissionsToGrants,inferUniversalPermissions} from '../../src/authorization/universal-workspace-permissions.js';

describe('explicit workspace + tab → resource mapping',()=>{
 it('declares every tab for every multi-resource workspace and only names registered resources',()=>{
  for(const key of registeredWorkspaceKeys()){
   const manifest=workspaceManifest(key);if(manifest.length<2)continue;
   const mapping=MULTI_RESOURCE_TAB_RESOURCES[key];
   expect(mapping,'explicit tab mapping for '+key).toBeDefined();
   for(const tab of WORKSPACE_TAB_KEYS)expect(manifest.map(resource=>resource.resourceType),key+' '+tab).toContain(mapping[tab]);
  }
 });
 it('does not depend on manifest order',()=>{
  expect(resourceForTab('fees-payments','GRID_1')?.resourceType).toBe('fee-structure');
  expect(resourceForTab('assets','GRID_3')?.resourceType).toBe('asset-maintenance');
  expect(resourceForTab('students','GRID_3')?.resourceType).toBe('student');
  expect(resourceForTab('unknown-workspace','MAIN')).toBeNull();
 });
 it('maps a resource back to its tabs without positional lookup',()=>{
  expect(tabsForResource('fees-payments','fee-assignment')).toEqual(['GRID_2']);
  expect(defaultTabForResource('fees-payments','fee-correction')).toBe('GRID_3');
  expect(defaultTabForResource('students','student')).toBe('MAIN');
 });
 it('derives grants for a tab from that tab\'s own resource and constraint',()=>{
  const grants=universalPermissionsToGrants('fees-payments',[{tabKey:'GRID_1',permissionKey:'VIEW'},{tabKey:'SPECIAL',permissionKey:'VIEW_RECORDS_OWNED_BY_OTHERS'}]);
  expect(grants.length).toBeGreaterThan(0);
  for(const grant of grants){expect(grant.resourceType).toBe('fee-structure');expect(grant.constraints.tabKey).toBe('GRID_1')}
  expect(inferUniversalPermissions('fees-payments',grants)).toContainEqual({tabKey:'GRID_1',permissionKey:'VIEW'});
 });
});
