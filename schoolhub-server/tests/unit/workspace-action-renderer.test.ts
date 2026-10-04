import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,beforeEach} from 'vitest';

type Action={actionKey:string;operationKey:string;label:string;tab:string;placement:string;visible:boolean;order:number;permissionKey:string;permissionTab:string;recordStates:string[]};

function loadRenderer(){
 const source=readFileSync(new URL('../../../Server_Module_Completion/workspace-actions.js',import.meta.url),'utf8');
 const makeElement=()=>({dataset:{} as any,classList:{toggle(){}},children:[] as any[],removed:false,textContent:'',append(...nodes:any[]){for(const node of nodes){this.children.push(node);this.textContent+=node.textContent||''}},addEventListener(){},remove(){this.removed=true},querySelectorAll(selector:string){return selector.includes('workspace-action-created')?this.children.filter((x:any)=>x.dataset?.workspaceActionCreated==='true'&&!x.removed):[]}});
 const document:any={readyState:'loading',documentElement:{},head:{appendChild(){}},getElementById(){return null},createElement(){return makeElement()},createTextNode(value:string){return{textContent:value}},addEventListener(){},querySelectorAll(){return[]}};
 const context:any={window:{schoolHubTransport:{server:{request:async()=>{throw Error('network not expected')}}}},document,MutationObserver:class{observe(){}},requestAnimationFrame:(fn:Function)=>fn(),setTimeout,clearTimeout,encodeURIComponent,console,confirm:()=>true,alert(){}};
 vm.runInNewContext(source,context,{filename:'workspace-actions.js'});
 return context.window.schoolHubWorkspaceActions;
}
const standard=(tab:string):Action[]=>[
 ['view','VIEW',['Active','Archived'],'row'],['add','ADD',['None'],'workspaceHeader'],['edit','EDIT',['Active'],'row'],['print','PRINT',['Active','Archived'],'row'],['archive','DELETE',['Active'],'overflow'],['restore','SPECIAL:RESTORE_ARCHIVED_RECORDS',['Archived'],'overflow'],['permanent-delete','SPECIAL:PERMANENT_DELETE',['Archived'],'overflow']
].map(([key,permission,states,placement],order)=>({actionKey:key as string,operationKey:key as string,label:String(key).replace(/(^|-)([a-z])/g,(_,p,c)=>String(c).toUpperCase()),tab,placement:placement as string,visible:true,order,permissionKey:permission as string,permissionTab:tab,recordStates:states as string[]}));
const actions=['MAIN','GRID_1','GRID_2','GRID_3'].flatMap(standard);
const admin={workspaceKey:'students',administratorOverride:true,layout:{actions}};
const ordinary=(overrides:any={})=>({workspaceKey:'students',administratorOverride:false,currentRole:'User',actionAccess:{visibleTabKeys:['MAIN','GRID_1','GRID_2','GRID_3'],addableTabKeys:[],editableTabKeys:[],deletableTabKeys:[],printableTabKeys:[],specialPermissionKeys:[],...overrides},layout:{actions}});

describe('universal frontend action renderer',()=>{
 let api:any;
 beforeEach(()=>{api=loadRenderer();for(const operation of ['view','add','edit','print','archive','restore','permanent-delete'])api.register('students',operation,()=>undefined)});
 const labels=(model:any,tab:string,state:string,placements=['row','overflow'])=>api.project(model,{workspaceKey:'students',tab,recordState:state,placements}).map((x:Action)=>x.operationKey);
 it('creates and deduplicates actual controls in a runtime host',async()=>{
  const host:any={dataset:{},children:[] as any[],querySelectorAll(selector:string){return selector.includes('workspace-action-created')?this.children.filter((x:any)=>x.dataset?.workspaceActionCreated==='true'&&!x.removed):[]},append(node:any){this.children.push(node)}};
  const first=await api.render(host,'students',{model:admin,tab:'MAIN',recordState:'Active',placements:['row','overflow'],context:{recordId:'student-1'}});
  expect(first.map((x:Action)=>x.operationKey)).toEqual(['view','edit','print','archive']);
  expect(host.children.filter((x:any)=>!x.removed).map((x:any)=>x.textContent)).toEqual(['View','Edit','Print','Archive']);
  await api.render(host,'students',{model:admin,tab:'MAIN',recordState:'Archived',placements:['row','overflow'],context:{recordId:'student-1'}});
  expect(host.children.filter((x:any)=>!x.removed).map((x:any)=>x.textContent)).toEqual(['View','Print','Restore','PermanentDelete']);
 });
 it('projects System Administrator MAIN actions by lifecycle',()=>{
  expect(labels(admin,'MAIN','Active')).toEqual(['view','edit','print','archive']);
  expect(labels(admin,'MAIN','Archived')).toEqual(['view','print','restore','permanent-delete']);
 });
 it.each(['GRID_1','GRID_2','GRID_3'])('uses the same renderer for %s',(tab)=>{
  expect(labels(admin,tab,'Active')).toEqual(['view','edit','print','archive']);
  expect(labels(admin,tab,'Archived')).toEqual(['view','print','restore','permanent-delete']);
 });
 it('filters Edit and Archive for an ordinary user without permissions',()=>{
  const model=ordinary({printableTabKeys:['MAIN']});
  expect(labels(model,'MAIN','Active')).toEqual(['view','print']);
 });
 it('requires archived visibility plus restore or permanent-delete capabilities',()=>{
  const restore=ordinary({deletableTabKeys:['MAIN'],specialPermissionKeys:['VIEW_ARCHIVED_RECORDS','RESTORE_ARCHIVED_RECORDS']});
  expect(labels(restore,'MAIN','Archived')).toEqual(['view','restore']);
  const purge=ordinary({deletableTabKeys:['MAIN'],specialPermissionKeys:['VIEW_ARCHIVED_RECORDS','PERMANENT_DELETE']});
  expect(labels(purge,'MAIN','Archived')).toEqual(['view','permanent-delete']);
 });
 it('projects Add only in a tab toolbar and never per row',()=>{
  expect(labels(admin,'MAIN','None',['workspaceHeader','sectionHeader'])).toEqual(['add']);
  expect(labels(admin,'MAIN','Active')).not.toContain('add');
 });
 it('does not invent optional actions and omits unknown operations',()=>{
  expect(labels(admin,'MAIN','Active')).not.toContain('admission-form');
  const unknown={...admin,layout:{actions:[...actions,{...standard('MAIN')[0],actionKey:'mystery',operationKey:'missing-handler',label:'Mystery',order:99}]}};
  expect(labels(unknown,'MAIN','Active')).not.toContain('missing-handler');
 });
 it('keeps native special actions while standard actions use universal hosts',()=>{
  const html=readFileSync(new URL('../../../SchoolHub_School_Management_App_Complete.html',import.meta.url),'utf8');
  expect(html).toContain('>Admission Form</button>');
  expect(html).toContain('data-student-main-action-host');
  const renderer=readFileSync(new URL('../../../Server_Module_Completion/workspace-actions.js',import.meta.url),'utf8');
  expect(renderer).toContain("if(!action)continue");
 });
});
