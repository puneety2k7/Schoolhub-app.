import {isRegisteredWorkspaceOperation} from './workspace-operation-registry.js';
import {z} from 'zod';
import {ApiError} from '../errors/api-error.js';
import {UNIVERSAL_SPECIAL_PERMISSIONS} from '../authorization/universal-workspace-permissions.js';

const key=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,119}$/);
const sourceTab=z.enum(['MAIN','GRID_1','GRID_2','GRID_3']);
const actionTab=z.enum(['DASHBOARD','MAIN','GRID_1','GRID_2','GRID_3']);
const actionPermission=z.enum(['VIEW','ADD','EDIT','DELETE','PRINT','INHERIT',...UNIVERSAL_SPECIAL_PERMISSIONS.map(key=>'SPECIAL:'+key)] as [string,...string[]]);
const fieldsTabContentSchema=z.object({mode:z.literal('fields')}).strict();
const templateTabContentSchema=z.object({
 mode:z.enum(['form','document']),templateId:key,templateName:z.string().trim().min(1).max(160),
 templateVersion:z.number().int().positive(),operationKey:key.optional()
}).strict();
export const tabContentAssignmentSchema=z.union([fieldsTabContentSchema,templateTabContentSchema]);
const tabContentSchema=z.object({
 MAIN:tabContentAssignmentSchema.default({mode:'fields'}),
 GRID_1:tabContentAssignmentSchema.default({mode:'fields'}),
 GRID_2:tabContentAssignmentSchema.default({mode:'fields'}),
 GRID_3:tabContentAssignmentSchema.default({mode:'fields'})
}).strict().default({MAIN:{mode:'fields'},GRID_1:{mode:'fields'},GRID_2:{mode:'fields'},GRID_3:{mode:'fields'}});
export const layoutComponentSchema=z.object({
 id:key,type:z.enum(['metric','chart','filters','table','calendar','schedule','cards']),
 title:z.string().trim().min(1).max(120),sourceTab,fields:z.array(key).max(100).default([]),
 visible:z.boolean().default(true),width:z.enum(['full','half','third','quarter']).default('half'),
 aggregation:z.enum(['count','distinct','sum','average','min','max','ratio']).optional(),
 valueField:key.optional(),secondaryValueField:key.optional(),titleField:key.optional(),startField:key.optional(),endField:key.optional(),
 groupField:key.optional(),slotField:key.optional(),imageField:key.optional(),
 visualization:z.enum(['bar','horizontalBar','stackedBar','line','area','pie','donut']).optional(),
 palette:z.enum(['blue','green','orange','purple','red','paymentStatus','school']).optional(),
 icon:z.enum(['records','money','wallet','clock','percent','people','warning','calendar','table','chart']).optional(),
 description:z.string().trim().max(240).optional(),showLegend:z.boolean().optional(),showPercentages:z.boolean().optional(),showLabels:z.boolean().optional(),
 roleNames:z.array(z.string().trim().min(1).max(120)).max(50).optional(),limit:z.number().int().min(1).max(100).optional(),
 conditions:z.array(z.object({field:key,operator:z.enum(['eq','ne','contains','notEmpty']),value:z.string().max(200)}).strict()).max(20).optional(),
 format:z.enum(['number','currency','percent']).optional(),currency:z.string().regex(/^[A-Z]{3}$/).optional(),
 columns:z.number().int().min(1).max(6).optional()
}).strict();

export const workspaceActionSchema=z.object({
 id:key,actionKey:key,operationKey:key,
 label:z.string().trim().min(1).max(120),description:z.string().trim().max(240).optional(),
 tab:actionTab.default('MAIN'),sectionKey:key.optional(),
 placement:z.enum(['workspaceHeader','sectionHeader','row','overflow']).default('workspaceHeader'),
 style:z.enum(['primary','secondary','danger']).default('secondary'),
 icon:z.string().trim().max(80).optional(),visible:z.boolean().default(true),order:z.number().int().min(0).max(10000).default(0),
 permissionKey:actionPermission.optional(),permissionTab:sourceTab.optional(),roleNames:z.array(z.string().trim().min(1).max(120)).max(50).optional(),
 recordStates:z.array(z.enum(['None','Active','Archived'])).max(3).optional(),
 interaction:z.enum(['drawer','direct','confirm','print','navigate']).default('drawer'),
 confirmationMessage:z.string().trim().max(300).optional(),successMessage:z.string().trim().max(240).optional(),
 refresh:z.enum(['none','tab','workspace']).default('tab')
}).strict();
export const workspaceLayoutSchema=z.object({
 schemaVersion:z.literal(1),enabled:z.boolean(),dashboardSource:z.enum(['firstView','fieldComponents']).default('fieldComponents'),density:z.enum(['comfortable','compact']),
 components:z.array(layoutComponentSchema).max(60),tabContent:tabContentSchema,actions:z.array(workspaceActionSchema).max(200).default([])
}).strict().superRefine((value,ctx)=>{
 const ids=new Set<string>();
 for(const component of value.components){if(ids.has(component.id))ctx.addIssue({code:'custom',path:['components'],message:'Component IDs must be unique.'});ids.add(component.id)}
 const actionIds=new Set<string>(),actionKeys=new Set<string>();for(const [tabKey,content] of Object.entries(value.tabContent))if(content.mode!=='fields'&&content.operationKey&&!isRegisteredWorkspaceOperation(content.operationKey))ctx.addIssue({code:'custom',path:['tabContent',tabKey],message:'Tab operation keys must be registered.'});
 for(const action of value.actions){if(actionIds.has(action.id))ctx.addIssue({code:'custom',path:['actions'],message:'Action IDs must be unique.'});actionIds.add(action.id);if(!isRegisteredWorkspaceOperation(action.operationKey))ctx.addIssue({code:'custom',path:['actions'],message:'Action operation keys must be registered.'});const scope=action.tab+':'+action.actionKey;if(actionKeys.has(scope))ctx.addIssue({code:'custom',path:['actions'],message:'Action keys must be unique inside each tab.'});actionKeys.add(scope);if(action.interaction==='confirm'&&!action.confirmationMessage)ctx.addIssue({code:'custom',path:['actions'],message:'A confirmation message is required for confirmation actions.'})}
});

export type WorkspaceLayout=z.infer<typeof workspaceLayoutSchema>;
export type LayoutComponent=z.infer<typeof layoutComponentSchema>;

const standardActionTemplates=Object.freeze([
 {actionKey:'view',operationKey:'view',label:'View',placement:'row',style:'secondary',interaction:'direct',refresh:'none',permissionKey:'VIEW',recordStates:['Active','Archived']},
 {actionKey:'add',operationKey:'add',label:'Add',placement:'workspaceHeader',style:'primary',interaction:'drawer',refresh:'tab',permissionKey:'ADD',recordStates:['None']},
 {actionKey:'edit',operationKey:'edit',label:'Edit',placement:'row',style:'secondary',interaction:'drawer',refresh:'tab',permissionKey:'EDIT',recordStates:['Active']},
 {actionKey:'print',operationKey:'print',label:'Print',placement:'row',style:'secondary',interaction:'print',refresh:'none',permissionKey:'PRINT',recordStates:['Active','Archived']},
 {actionKey:'archive',operationKey:'archive',label:'Archive',placement:'overflow',style:'danger',interaction:'confirm',confirmationMessage:'Archive this record?',refresh:'tab',permissionKey:'DELETE',recordStates:['Active']},
 {actionKey:'restore',operationKey:'restore',label:'Restore',placement:'overflow',style:'secondary',interaction:'confirm',confirmationMessage:'Restore this archived record?',refresh:'tab',permissionKey:'SPECIAL:RESTORE_ARCHIVED_RECORDS',recordStates:['Archived']},
 {actionKey:'permanent-delete',operationKey:'permanent-delete',label:'Permanent Delete',placement:'overflow',style:'danger',interaction:'confirm',confirmationMessage:'Permanently delete this archived record?',refresh:'tab',permissionKey:'SPECIAL:PERMANENT_DELETE',recordStates:['Archived']}
] as const);
export function standardWorkspaceActions():WorkspaceLayout['actions']{
 return (['MAIN','GRID_1','GRID_2','GRID_3'] as const).flatMap((tab,tabIndex)=>standardActionTemplates.map((template,index)=>workspaceActionSchema.parse({...template,id:'standard_'+tab.toLowerCase()+'_'+template.actionKey.replaceAll('-','_'),tab,permissionTab:tab,visible:true,order:tabIndex*20+index})));
}
export function normalizeWorkspaceActions(actions:WorkspaceLayout['actions']):WorkspaceLayout['actions']{
 const normalized=actions.map(action=>({...action})),byScope=new Map(normalized.map(action=>[action.tab+':'+action.actionKey,action]));
 for(const standard of standardWorkspaceActions()){
  const existing=byScope.get(standard.tab+':'+standard.actionKey);
  if(existing){Object.assign(existing,{operationKey:standard.operationKey,label:standard.label,placement:standard.placement,permissionKey:standard.permissionKey,permissionTab:standard.permissionTab,recordStates:standard.recordStates});continue}
  normalized.push(standard);
 }
 return normalized;
}
export function defaultWorkspaceLayout():WorkspaceLayout{return{schemaVersion:1,enabled:true,dashboardSource:'fieldComponents',density:'comfortable',components:[],tabContent:{MAIN:{mode:'fields'},GRID_1:{mode:'fields'},GRID_2:{mode:'fields'},GRID_3:{mode:'fields'}},actions:standardWorkspaceActions()}}

export function readWorkspaceLayout(raw:any):WorkspaceLayout{
 if(typeof raw==='string')try{raw=JSON.parse(raw)}catch{raw=null}
 const parsed=workspaceLayoutSchema.safeParse(raw);if(!parsed.success)return defaultWorkspaceLayout();return{...parsed.data,actions:normalizeWorkspaceActions(parsed.data.actions)};
}

export function componentFieldKeys(component:LayoutComponent){
 return [...new Set([...component.fields,...[component.valueField,component.secondaryValueField,component.titleField,component.startField,component.endField,component.groupField,component.slotField,component.imageField].filter((value):value is string=>!!value),...(component.conditions||[]).map(condition=>condition.field)])];
}

export function validateLayoutFields(layout:WorkspaceLayout,fields:any[]){
 const available=new Map(fields.filter(field=>!field.archived).map(field=>[field.fieldKey,field]));
 const requireMapping=(component:LayoutComponent,property:keyof LayoutComponent)=>{if(!component[property])throw new ApiError('LAYOUT_MAPPING_REQUIRED','Complete the component field mappings.',422,{component:component.id,property})};
 for(const component of layout.components){
  for(const fieldKey of componentFieldKeys(component)){const field=available.get(fieldKey);if(!field||(field.tabKey||'MAIN')!==component.sourceTab)throw new ApiError('INVALID_LAYOUT_FIELD','Choose an existing field from the selected source tab.',422,{component:component.id,field:fieldKey})}
  if(['table','filters'].includes(component.type)&&!component.fields.length)throw new ApiError('LAYOUT_MAPPING_REQUIRED','Choose at least one workspace field.',422,{component:component.id});
  if(component.type==='metric'&&(component.aggregation||'count')!=='count')requireMapping(component,'valueField');if(component.aggregation==='ratio')requireMapping(component,'secondaryValueField');
  if(component.type==='chart'){requireMapping(component,'groupField');if((component.aggregation||'count')!=='count')requireMapping(component,'valueField');if(component.aggregation==='ratio')requireMapping(component,'secondaryValueField')}
  if(component.type==='calendar'){requireMapping(component,'titleField');requireMapping(component,'startField')}
  if(component.type==='schedule'){requireMapping(component,'titleField');requireMapping(component,'groupField');requireMapping(component,'slotField')}
  if(component.type==='cards')requireMapping(component,'titleField');
  const mode=component.aggregation||'count';
  if(['sum','average','min','max','ratio'].includes(mode)){const numericKeys=[component.valueField,...(mode==='ratio'?[component.secondaryValueField]:[])];for(const fieldKey of numericKeys){const field=available.get(fieldKey!);if(!['integer','decimal','currency'].includes(field?.fieldType))throw new ApiError('LAYOUT_NUMERIC_FIELD_REQUIRED','Choose numeric fields for this calculation.',422,{component:component.id})}}
  if(component.type==='calendar')for(const fieldKey of [component.startField,component.endField].filter(Boolean))if(!['date','dateTime'].includes(available.get(fieldKey!)?.fieldType))throw new ApiError('LAYOUT_DATE_FIELD_REQUIRED','Choose a date field for calendar dates.',422,{component:component.id});
  if(component.imageField&&available.get(component.imageField)?.fieldType!=='image')throw new ApiError('LAYOUT_IMAGE_FIELD_REQUIRED','Choose an image field.',422,{component:component.id});
 }
}

export type WorkspaceActionAccess={
 visibleTabKeys:string[];addableTabKeys:string[];editableTabKeys:string[];deletableTabKeys:string[];printableTabKeys:string[];specialPermissionKeys:string[];
};
function actionAllowed(action:WorkspaceLayout['actions'][number],access?:WorkspaceActionAccess){
 if(!access)return true;
 const tab=action.permissionTab||(action.tab==='DASHBOARD'?'MAIN':action.tab),permission=action.permissionKey;
 if(!permission)return false;
 if(permission==='VIEW')return access.visibleTabKeys.includes(tab);
 if(permission==='ADD')return access.addableTabKeys.includes(tab);
 if(permission==='EDIT')return access.editableTabKeys.includes(tab);
 if(permission==='DELETE')return access.deletableTabKeys.includes(tab);
 if(permission==='PRINT')return access.printableTabKeys.includes(tab);
 if(permission==='INHERIT')return access.addableTabKeys.includes(tab)||access.editableTabKeys.includes(tab);
 if(permission==='SPECIAL:RESTORE_ARCHIVED_RECORDS')return access.visibleTabKeys.includes(tab)&&access.specialPermissionKeys.includes('VIEW_ARCHIVED_RECORDS')&&access.specialPermissionKeys.includes('RESTORE_ARCHIVED_RECORDS');
 if(permission==='SPECIAL:PERMANENT_DELETE')return access.deletableTabKeys.includes(tab)&&access.specialPermissionKeys.includes('PERMANENT_DELETE');
 if(permission.startsWith('SPECIAL:'))return access.specialPermissionKeys.includes(permission.slice(8));
 return false;
}
export function projectLayout(layout:WorkspaceLayout,fields:any[],visibleTabs:string[],roleName?:string,actionAccess?:WorkspaceActionAccess,recordState?:'None'|'Active'|'Archived'):WorkspaceLayout{
 const keys=new Set(fields.map(field=>field.fieldKey));
 return{...layout,components:layout.components.filter(component=>visibleTabs.includes(component.sourceTab)&&componentFieldKeys(component).every(key=>keys.has(key))&&(!component.roleNames?.length||!roleName||component.roleNames.includes(roleName))),actions:layout.actions.filter(action=>(action.tab==='DASHBOARD'||visibleTabs.includes(action.tab))&&(!action.roleNames?.length||!roleName||action.roleNames.includes(roleName))&&(!recordState||!action.recordStates?.length||action.recordStates.includes(recordState))&&(recordState!=='Archived'||actionAccess?.specialPermissionKeys.includes('VIEW_ARCHIVED_RECORDS')||!actionAccess)&&actionAllowed(action,actionAccess))};
}


