import {UNIVERSAL_PERMISSION_DEFINITIONS,UNIVERSAL_SPECIAL_PERMISSIONS,UNIVERSAL_TAB_KEYS} from '../authorization/universal-workspace-permissions.js';
import {WORKSPACE_FIELD_TYPE_NAMES,OPERATIONAL_WORKSPACE_KEYS,SUPPORTING_ADMIN_AREA_KEYS,isOperationalWorkspaceDefinition} from './workspace-service.js';
import {componentFieldKeys,readWorkspaceLayout} from './workspace-layout.js';
import {isRegisteredWorkspaceOperation} from './workspace-operation-registry.js';

export const INTERNAL_REFERENCE_WORKSPACE_KEYS=Object.freeze(['academic-years','sections','subjects','homework-acknowledgements'] as const);
export type ConformanceIssue={severity:'WARNING'|'FAIL';workspaceId:string;workspaceKey:string;code:string;detail:string};
export type ConformanceWorkspace={id:string;schoolId:string;workspaceKey:string;system:boolean;tabConfiguration:any;layoutConfiguration:any;sections:any[];fields:any[]};

export function validateWorkspaceConformance(workspaces:readonly ConformanceWorkspace[]){
 const operational=workspaces.filter(isOperationalWorkspaceDefinition),supporting=workspaces.filter(w=>w.system&&(SUPPORTING_ADMIN_AREA_KEYS as readonly string[]).includes(w.workspaceKey)),internal=workspaces.filter(w=>w.system&&(INTERNAL_REFERENCE_WORKSPACE_KEYS as readonly string[]).includes(w.workspaceKey)),classified=new Set([...operational,...supporting,...internal].map(w=>w.id));
 const issues:ConformanceIssue[]=[],workspaceKeys=new Set(workspaces.flatMap(w=>[w.id,w.workspaceKey])),fieldTypes=new Set<string>(WORKSPACE_FIELD_TYPE_NAMES),tabs=new Set<string>(UNIVERSAL_TAB_KEYS);
 const issue=(severity:ConformanceIssue['severity'],workspace:ConformanceWorkspace,code:string,detail:string)=>issues.push({severity,workspaceId:workspace.id,workspaceKey:workspace.workspaceKey,code,detail});
 for(const workspace of workspaces)if(!classified.has(workspace.id))issue('FAIL',workspace,'UNCLASSIFIED_WORKSPACE','System definition is neither operational, supporting/admin, nor an internal reference.');
 for(const workspace of operational){
  const configured=workspace.tabConfiguration||{};for(const tab of UNIVERSAL_TAB_KEYS)if(typeof configured[tab]!=='string'||!configured[tab].trim())issue('FAIL',workspace,'MISSING_TAB',tab+' is missing.');
  for(const tab of Object.keys(configured))if(!tabs.has(tab))issue('FAIL',workspace,'INVALID_TAB',tab+' is not a standard tab key.');
  const sectionById=new Map(workspace.sections.map(section=>[section.id,section]));
  for(const section of workspace.sections)if(!tabs.has(section.tabKey))issue('FAIL',workspace,'INVALID_SECTION_TAB',section.sectionKey+' uses '+section.tabKey+'.');
  for(const field of workspace.fields){const section=sectionById.get(field.sectionId);if(!section)issue('FAIL',workspace,'ORPHAN_FIELD',field.fieldKey+' has no valid section.');else if(section.tabKey!==field.tabKey)issue('FAIL',workspace,'FIELD_TAB_MISMATCH',field.fieldKey+' does not match its section tab.');if(!fieldTypes.has(field.fieldType))issue('FAIL',workspace,'INVALID_FIELD_TYPE',field.fieldKey+' uses '+field.fieldType+'.');const target=field.configuration?.targetWorkspaceId||field.configuration?.targetWorkspaceKey;if(field.fieldType==='workspaceReference'&&(!target||!workspaceKeys.has(target)))issue('FAIL',workspace,'INVALID_WORKSPACE_REFERENCE',field.fieldKey+' has an invalid workspace reference.');if(['radio','singleSelect','multiSelect'].includes(field.fieldType)&&!field.configuration?.picklistId&&!field.hasOptions)issue('WARNING',workspace,'MISSING_PICKLIST',field.fieldKey+' has no active picklist/options.');}
  const layout=readWorkspaceLayout(workspace.layoutConfiguration),fields=new Map(workspace.fields.map(field=>[field.fieldKey,field]));
  for(const component of layout.components)for(const key of componentFieldKeys(component)){const field=fields.get(key);if(!field||field.tabKey!==component.sourceTab)issue('FAIL',workspace,'INVALID_LAYOUT_REFERENCE',component.id+' references '+key+'.')}
  for(const action of layout.actions){if(!tabs.has(action.tab)&&action.tab!=='DASHBOARD')issue('FAIL',workspace,'INVALID_ACTION_TAB',action.id+' uses '+action.tab+'.');if(!isRegisteredWorkspaceOperation(action.operationKey))issue('FAIL',workspace,'UNKNOWN_OPERATION',action.id+' uses '+action.operationKey+'.');if(!action.permissionKey)issue('FAIL',workspace,'MISSING_ACTION_PERMISSION',action.id+' has no permission binding.');}
 }
 const failed=new Set(issues.filter(x=>x.severity==='FAIL').map(x=>x.workspaceId)),warned=new Set(issues.filter(x=>x.severity==='WARNING').map(x=>x.workspaceId)),keys=(items:readonly ConformanceWorkspace[])=>[...new Set(items.map(w=>w.workspaceKey))].sort();
 return{
  permissionModel:{dashboard:UNIVERSAL_PERMISSION_DEFINITIONS.dashboard.length,normal:UNIVERSAL_TAB_KEYS.length*UNIVERSAL_PERMISSION_DEFINITIONS.normal.length,special:UNIVERSAL_SPECIAL_PERMISSIONS.length,total:UNIVERSAL_PERMISSION_DEFINITIONS.dashboard.length+UNIVERSAL_TAB_KEYS.length*UNIVERSAL_PERMISSION_DEFINITIONS.normal.length+UNIVERSAL_SPECIAL_PERMISSIONS.length},
  total:operational.length,passed:operational.filter(w=>!failed.has(w.id)&&!warned.has(w.id)).length,warnings:operational.filter(w=>warned.has(w.id)).length,failed:operational.filter(w=>failed.has(w.id)).length,
  operational:{definitionCount:operational.length,keys:keys(operational),builtInKeys:[...OPERATIONAL_WORKSPACE_KEYS],customKeys:keys(operational.filter(w=>!w.system))},
  supportingAdmin:{excludedDefinitionCount:supporting.length,configuredKeys:[...SUPPORTING_ADMIN_AREA_KEYS],presentKeys:keys(supporting),missingDefinitionKeys:SUPPORTING_ADMIN_AREA_KEYS.filter(key=>!supporting.some(w=>w.workspaceKey===key))},
  internalReferences:{excludedDefinitionCount:internal.length,keys:keys(internal)},
  issues
 };
}
