import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {defaultWorkspaceLayout,projectLayout,readWorkspaceLayout,standardWorkspaceActions,validateLayoutFields,workspaceLayoutSchema} from '../../src/services/workspace-layout.js';

const fields=[
 {fieldKey:'status',label:'Status',fieldType:'singleSelect',tabKey:'MAIN'},
 {fieldKey:'amount',label:'Amount',fieldType:'currency',tabKey:'MAIN'},
 {fieldKey:'eventDate',label:'Event date',fieldType:'date',tabKey:'GRID_1'}
];

describe('universal workspace dashboard layout',()=>{
 it('starts as an enabled, field-driven empty dashboard',()=>{
  const layout=defaultWorkspaceLayout();expect(layout).toMatchObject({schemaVersion:1,enabled:true,dashboardSource:'fieldComponents',density:'comfortable',components:[],tabContent:{MAIN:{mode:'fields'},GRID_1:{mode:'fields'},GRID_2:{mode:'fields'},GRID_3:{mode:'fields'}}});expect(layout.actions).toHaveLength(28);
 });
 it('keeps fields as the universal default and accepts one explicit template per tab',()=>{
  const layout=workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[],tabContent:{GRID_1:{mode:'form',templateId:'form_admission',templateName:'Admission Form',templateVersion:1,operationKey:'student_admission'}}});
  expect(layout.tabContent.MAIN).toEqual({mode:'fields'});
  expect(layout.tabContent.GRID_1).toMatchObject({mode:'form',templateId:'form_admission'});
  expect(layout.tabContent.GRID_2).toEqual({mode:'fields'});
 });
 it('accepts the same chart contract for any workspace field set',()=>{
  const layout=workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[{
   id:'status_totals',type:'chart',title:'Status totals',sourceTab:'MAIN',fields:[],visible:true,width:'half',aggregation:'sum',groupField:'status',valueField:'amount'
  }]});
  expect(()=>validateLayoutFields(layout,fields)).not.toThrow();
 });
 it('rejects a component that maps a field from another source tab',()=>{
  const layout=workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[{
   id:'calendar',type:'calendar',title:'Events',sourceTab:'MAIN',fields:[],visible:true,width:'full',titleField:'status',startField:'eventDate'
  }]});
  expect(()=>validateLayoutFields(layout,fields)).toThrow(/existing field from the selected source tab/i);
 });
 it('removes components whose fields are not readable by the current user',()=>{
  const layout=workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[{
   id:'totals',type:'metric',title:'Total',sourceTab:'MAIN',fields:[],visible:true,width:'third',aggregation:'sum',valueField:'amount'
  }]});
  expect(projectLayout(layout,[fields[0]],['MAIN']).components).toHaveLength(0);
 });
 it('supports universal ratio metrics, visual styles, and role visibility',()=>{
  const layout=workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[{
   id:'collection_rate',type:'metric',title:'Collection Rate',sourceTab:'MAIN',fields:[],visible:true,width:'quarter',aggregation:'ratio',valueField:'amount',secondaryValueField:'amount',format:'percent',palette:'purple',icon:'percent',roleNames:['Administrator']
  }]});
  expect(()=>validateLayoutFields(layout,fields)).not.toThrow();
  expect(projectLayout(layout,fields,['MAIN'],'Teacher').components).toHaveLength(0);
  expect(projectLayout(layout,fields,['MAIN'],'Administrator').components).toHaveLength(1);
 });
 it('validates editable action definitions and projects them by tab and role',()=>{
  const layout=workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[],actions:[{
   id:'add_record',actionKey:'add',operationKey:'add',label:'Add',tab:'MAIN',placement:'workspaceHeader',style:'primary',visible:true,order:1,interaction:'drawer',refresh:'tab',roleNames:['Administrator']
  }]});
  expect(projectLayout(layout,fields,['MAIN'],'Teacher').actions).toHaveLength(0);
  expect(projectLayout(layout,fields,['MAIN'],'Administrator').actions[0]).toMatchObject({actionKey:'add',label:'Add'});
 });
 it('filters actions through the selected tab Permission Overview capabilities',()=>{
  const layout=workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[],actions:[
   {id:'view_record',actionKey:'view',operationKey:'view',label:'View',tab:'GRID_1',permissionTab:'GRID_1',placement:'row',style:'secondary',visible:true,order:0,interaction:'direct',refresh:'none',permissionKey:'VIEW'},
   {id:'add_record',actionKey:'add',operationKey:'add',label:'Add',tab:'GRID_1',permissionTab:'GRID_1',placement:'workspaceHeader',style:'primary',visible:true,order:1,interaction:'drawer',refresh:'tab',permissionKey:'ADD'},
   {id:'save_record',actionKey:'save',operationKey:'save',label:'Save',tab:'GRID_1',permissionTab:'GRID_1',placement:'sectionHeader',style:'primary',visible:true,order:2,interaction:'direct',refresh:'tab',permissionKey:'INHERIT'},
   {id:'publish_record',actionKey:'publish',operationKey:'publish',label:'Publish',tab:'GRID_1',permissionTab:'GRID_1',placement:'row',style:'primary',visible:true,order:3,interaction:'direct',refresh:'tab',permissionKey:'SPECIAL:PUBLISH'}
  ]});
  const viewOnly={visibleTabKeys:['GRID_1'],addableTabKeys:[],editableTabKeys:[],deletableTabKeys:[],printableTabKeys:[],specialPermissionKeys:[]};
  expect(projectLayout(layout,fields,['GRID_1'],'Teacher',viewOnly).actions.map(x=>x.actionKey)).toEqual(['view']);
  const creator={...viewOnly,addableTabKeys:['GRID_1'],specialPermissionKeys:['PUBLISH']};
  expect(projectLayout(layout,fields,['GRID_1'],'Teacher',creator).actions.map(x=>x.actionKey)).toEqual(['view','add','save','publish']);
  expect(projectLayout(layout,fields,['GRID_1']).actions).toHaveLength(4);
 });
 it('validates every built-in workspace action factory against the shared schema',()=>{
  const factories=JSON.parse(readFileSync(new URL('../../src/factories/workspace-actions.json',import.meta.url),'utf8')) as Record<string,unknown[]>;
  expect(Object.keys(factories)).toHaveLength(20);
  for(const [workspaceKey,actions] of Object.entries(factories)){
   const result=workspaceLayoutSchema.safeParse({...defaultWorkspaceLayout(),actions});
   expect(result.success,workspaceKey+(result.success?'':': '+result.error.issues.map(issue=>issue.message).join(' '))).toBe(true);
  }
 });
 it('rejects unknown configured operation keys',()=>{
  expect(()=>workspaceLayoutSchema.parse({...defaultWorkspaceLayout(),actions:[{id:'unknown_action',actionKey:'unknown',operationKey:'not_registered',label:'Unknown',tab:'MAIN',placement:'row',style:'secondary',visible:true,order:1,interaction:'direct',refresh:'none',permissionKey:'VIEW'}]})).toThrow(/operation keys must be registered/i);
 });
 it('requires confirmation text for configured confirmation actions',()=>{
  expect(()=>workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[],actions:[{
   id:'archive_record',actionKey:'archive',operationKey:'record_archive',label:'Archive',tab:'MAIN',placement:'row',style:'danger',visible:true,order:1,interaction:'confirm',refresh:'tab'
  }]})).toThrow(/confirmation message/i);
 }); it('keeps administrators able to edit every role-targeted component',()=>{
  const layout=workspaceLayoutSchema.parse({schemaVersion:1,enabled:true,density:'comfortable',components:[{
   id:'admin_metric',type:'metric',title:'Admin metric',sourceTab:'MAIN',fields:[],visible:true,width:'quarter',aggregation:'count',roleNames:['Administrator']
  }]});
  expect(projectLayout(layout,fields,['MAIN']).components).toHaveLength(1);
 });

 it('supplies every standard core action centrally for all four operational tabs without duplicating equivalent actions',()=>{
  const actions=standardWorkspaceActions(),keys=['view','add','edit','print','archive','restore','permanent-delete'];
  for(const tab of ['MAIN','GRID_1','GRID_2','GRID_3'])expect(actions.filter(action=>action.tab===tab).map(action=>action.actionKey)).toEqual(keys);
  const configured=workspaceLayoutSchema.parse({...defaultWorkspaceLayout(),actions:[{...actions[0],label:'Open record'}]});
  const normalized=readWorkspaceLayout(configured);
  expect(normalized.actions.filter(action=>action.tab==='MAIN'&&action.actionKey==='view')).toHaveLength(1);
  expect(normalized.actions.find(action=>action.tab==='MAIN'&&action.actionKey==='view')?.label).toBe('View');
  expect(actions.filter(action=>action.actionKey==='add').every(action=>action.label==='Add'&&action.permissionKey==='ADD'&&action.placement==='workspaceHeader')).toBe(true);
  expect(normalized.actions.some(action=>action.actionKey==='publish')).toBe(false);
 });
 it('applies standard action permissions and record lifecycle context for ordinary and System Administrators',()=>{
  const layout=defaultWorkspaceLayout(),none={visibleTabKeys:[],addableTabKeys:[],editableTabKeys:[],deletableTabKeys:[],printableTabKeys:[],specialPermissionKeys:[]};
  expect(projectLayout(layout,[],['MAIN'],'User',none,'Active').actions).toEqual([]);
  const main={visibleTabKeys:['MAIN'],addableTabKeys:['MAIN'],editableTabKeys:['MAIN'],deletableTabKeys:['MAIN'],printableTabKeys:['MAIN'],specialPermissionKeys:['VIEW_ARCHIVED_RECORDS','RESTORE_ARCHIVED_RECORDS','PERMANENT_DELETE']};
  expect(projectLayout(layout,[],['MAIN'],'User',main,'Active').actions.map(action=>action.actionKey)).toEqual(['view','edit','print','archive']);
  expect(projectLayout(layout,[],['MAIN'],'User',main,'Archived').actions.map(action=>action.actionKey)).toEqual(['view','print','restore','permanent-delete']);
  expect(projectLayout(layout,[],['MAIN'],'User',main,'None').actions.map(action=>action.actionKey)).toEqual(['add']);
  const system={visibleTabKeys:['MAIN','GRID_1','GRID_2','GRID_3'],addableTabKeys:['MAIN','GRID_1','GRID_2','GRID_3'],editableTabKeys:['MAIN','GRID_1','GRID_2','GRID_3'],deletableTabKeys:['MAIN','GRID_1','GRID_2','GRID_3'],printableTabKeys:['MAIN','GRID_1','GRID_2','GRID_3'],specialPermissionKeys:['VIEW_ARCHIVED_RECORDS','RESTORE_ARCHIVED_RECORDS','PERMANENT_DELETE']};
  for(const tab of ['MAIN','GRID_1','GRID_2','GRID_3'])expect(projectLayout(layout,[],[tab],undefined,system,'Active').actions.some(action=>action.tab===tab&&action.actionKey==='view')).toBe(true);
 });

});

