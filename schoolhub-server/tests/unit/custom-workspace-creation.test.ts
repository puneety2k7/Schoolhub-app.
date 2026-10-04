import {describe,expect,it} from 'vitest';
import {WorkspaceService} from '../../src/services/workspace-service.js';
import {UNIVERSAL_PERMISSION_DEFINITIONS,UNIVERSAL_SPECIAL_PERMISSIONS,UNIVERSAL_TAB_KEYS} from '../../src/authorization/universal-workspace-permissions.js';

class CustomWorkspaceService extends WorkspaceService{async syncFactories(){return{factoryVersion:0,created:0,upgraded:0}}}
function database(){
 let workspace:any;
 const db:any={transaction:async(work:any)=>work(db),close:async()=>{},query:async(sql:string,values:any[]=[])=>{
  if(sql.startsWith('INSERT INTO workspace_definitions')){workspace={id:values[0],schoolId:values[1],workspaceKey:values[2],name:values[3],pluralName:values[4],description:values[5],category:values[6],icon:values[7],workspaceType:'Custom',status:'Draft',system:false,factoryVersion:0,definitionVersion:1,tabConfiguration:{},printConfiguration:{},recordNumberConfiguration:{},navigationConfiguration:{},behaviorConfiguration:{},layoutConfiguration:{},createdAt:new Date(),updatedAt:new Date(),version:1};return{rows:[{id:workspace.id}],rowCount:1}}
  if(sql.includes('FROM workspace_definitions WHERE id=$1'))return{rows:workspace?[workspace]:[],rowCount:workspace?1:0};
  if(sql.includes('SELECT settings FROM schools'))return{rows:[{settings:{}}],rowCount:1};
  if(sql.includes('FROM workspace_sections'))return{rows:[],rowCount:0};
  if(sql.includes('FROM workspace_section_role_visibility'))return{rows:[],rowCount:0};
  if(sql.includes('FROM workspace_fields'))return{rows:[],rowCount:0};
  if(sql.includes('FROM workspace_field_options'))return{rows:[],rowCount:0};
  if(sql.startsWith('INSERT INTO workspace_definition_versions')||sql.startsWith('INSERT INTO audit_events'))return{rows:[],rowCount:1};
  throw new Error('Unexpected SQL: '+sql);
 }};
 return db;
}
describe('actual custom workspace creation defaults',()=>{
 it('creates through WorkspaceService with the full universal engine and standard actions',async()=>{
  const service=new CustomWorkspaceService(database()),p:any={schoolId:'school',userId:'admin',permissions:['workspaces:create'],roleName:'Administrator'};
  const workspace:any=await service.create(p,{workspaceKey:'custom-activities',name:'Activity',pluralName:'Activities',description:'',category:'Custom'},'corr');
  expect(workspace.system).toBe(false);expect(workspace.tabConfiguration).toMatchObject({MAIN:'Main Tab',GRID_1:'Grid Tab 1',GRID_2:'Grid Tab 2',GRID_3:'Grid Tab 3'});
  expect(workspace.sections).toEqual([]);expect(workspace.unassignedFields).toEqual([]);expect(workspace.layoutConfiguration.tabContent).toBeDefined();
  for(const tab of UNIVERSAL_TAB_KEYS)expect(workspace.layoutConfiguration.actions.filter((action:any)=>action.tab===tab)).toHaveLength(7);
  expect(UNIVERSAL_PERMISSION_DEFINITIONS.dashboard.length+UNIVERSAL_TAB_KEYS.length*UNIVERSAL_PERMISSION_DEFINITIONS.normal.length+UNIVERSAL_SPECIAL_PERMISSIONS.length).toBe(41);
 });
});
