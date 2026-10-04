import {workspaceManifest,type ResourcePolicy} from './policy-registry.js';

/**
 * Central, explicit workspace + tab → resource mapping.
 *
 * Permissions and actions resolve a resource from (workspaceKey, tabKey). The resolution is never
 * derived from the position of a resource inside a manifest array. A workspace that registers a
 * single resource serves every tab with that one resource. A workspace that registers several
 * resources MUST declare which resource serves each tab here; a missing entry resolves to no
 * resource (fail closed) and is rejected by tests/unit/workspace-tab-resources.test.ts.
 *
 * The values below reproduce the effective access each workspace had before the positional lookup
 * was removed, so this change neither broadens nor narrows any role's access.
 */
export const WORKSPACE_TAB_KEYS=['MAIN','GRID_1','GRID_2','GRID_3'] as const;
export type WorkspaceTabKey=typeof WORKSPACE_TAB_KEYS[number];

export const MULTI_RESOURCE_TAB_RESOURCES:Readonly<Record<string,Readonly<Record<WorkspaceTabKey,string>>>>=Object.freeze({
 staff:{MAIN:'staff',GRID_1:'teaching-assignment',GRID_2:'staff',GRID_3:'staff'},
 timetable:{MAIN:'timetable-entry',GRID_1:'timetable-period',GRID_2:'timetable-entry',GRID_3:'timetable-entry'},
 homework:{MAIN:'homework',GRID_1:'homework-acknowledgement',GRID_2:'homework',GRID_3:'homework'},
 'exams-results':{MAIN:'exam',GRID_1:'mark',GRID_2:'report-card',GRID_3:'exam'},
 'fees-payments':{MAIN:'fee-payment',GRID_1:'fee-structure',GRID_2:'fee-assignment',GRID_3:'fee-correction'},
 assets:{MAIN:'asset-category',GRID_1:'asset',GRID_2:'asset-assignment',GRID_3:'asset-maintenance'},
 idcards:{MAIN:'id-card-template',GRID_1:'digital-id-card',GRID_2:'id-card-template',GRID_3:'id-card-template'},
 access:{MAIN:'access-role',GRID_1:'access-group',GRID_2:'workspace-definition',GRID_3:'security-audit'},
 portal:{MAIN:'portal-configuration',GRID_1:'portal-profile',GRID_2:'portal-configuration',GRID_3:'portal-configuration'}
});

const TEST_TAB_RESOURCES=new Map<string,Readonly<Record<WorkspaceTabKey,string>>>();
export function registerTestWorkspaceTabResources(workspaceKey:string,mapping:Readonly<Record<WorkspaceTabKey,string>>){
 if(process.env.NODE_ENV!=='test')throw new Error('Test tab-resource registration is available only in NODE_ENV=test.');
 TEST_TAB_RESOURCES.set(workspaceKey,Object.freeze({...mapping}));return()=>TEST_TAB_RESOURCES.delete(workspaceKey);
}

function resourceTypeForTab(workspaceKey:string,tabKey:WorkspaceTabKey,manifest:readonly ResourcePolicy[]):string|null{
 const explicit=TEST_TAB_RESOURCES.get(workspaceKey)||MULTI_RESOURCE_TAB_RESOURCES[workspaceKey];
 if(explicit)return explicit[tabKey]||null;
 return manifest.length===1?manifest[0].resourceType:null;
}

/** The resource policy that serves a tab, or null when the workspace declares none for it. */
export function resourceForTab(workspaceKey:string,tabKey:WorkspaceTabKey):ResourcePolicy|null{
 const manifest=workspaceManifest(workspaceKey),type=resourceTypeForTab(workspaceKey,tabKey,manifest);
 return type?manifest.find(resource=>resource.resourceType===type)||null:null;
}

/** Tabs served by a resource, in tab order. */
export function tabsForResource(workspaceKey:string,resourceType:string):WorkspaceTabKey[]{
 const manifest=workspaceManifest(workspaceKey);
 return WORKSPACE_TAB_KEYS.filter(tabKey=>resourceTypeForTab(workspaceKey,tabKey,manifest)===resourceType);
}

/** The tab a resource's un-scoped grants belong to; MAIN when the resource serves no tab. */
export function defaultTabForResource(workspaceKey:string,resourceType:string):WorkspaceTabKey{
 return tabsForResource(workspaceKey,resourceType)[0]||'MAIN';
}
