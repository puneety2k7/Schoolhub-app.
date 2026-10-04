import {describe,expect,it} from 'vitest';
import {isOperationalWorkspaceDefinition,OPERATIONAL_WORKSPACE_KEYS,SUPPORTING_ADMIN_AREA_KEYS} from '../../src/services/workspace-service.js';
import {validateWorkspaceConformance} from '../../src/services/workspace-conformance.js';

const workspace=(workspaceKey:string,system:boolean,tabConfiguration:any)=>({id:workspaceKey,schoolId:'school',workspaceKey,system,tabConfiguration,layoutConfiguration:{},sections:[],fields:[]});

describe('workspace classification',()=>{
 it('includes built-in and custom operational workspaces while excluding the fixed platform areas',()=>{
  expect(isOperationalWorkspaceDefinition({system:true,workspaceKey:'students'})).toBe(true);
  expect(isOperationalWorkspaceDefinition({system:false,workspaceKey:'custom-workspace'})).toBe(true);
  for(const workspaceKey of SUPPORTING_ADMIN_AREA_KEYS)expect(isOperationalWorkspaceDefinition({system:true,workspaceKey})).toBe(false);
  expect(OPERATIONAL_WORKSPACE_KEYS).toHaveLength(20);
 });
 it('does not treat engine-added tab defaults on supporting areas as an operational contract',()=>{
  const result=validateWorkspaceConformance([
   workspace('students',true,{MAIN:'Main',GRID_1:'One',GRID_2:'Two',GRID_3:'Three'}),
   workspace('custom-workspace',false,{MAIN:'Main',GRID_1:'One',GRID_2:'Two',GRID_3:'Three'}),
   workspace('portal',true,{MAIN:'Main',GRID_1:'One',GRID_2:'Two',GRID_3:'Three'})
  ]);
  expect(result.total).toBe(2);
  expect(result.failed).toBe(0);
  expect(result.supportingAdmin.excludedDefinitionCount).toBe(1);
  expect(result.supportingAdmin.presentKeys).toEqual(['portal']);
 });
});
