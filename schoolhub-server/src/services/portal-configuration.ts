import type { Queryable } from '../database/types.js';

export const PORTAL_MODULE_KEYS=['attendance','homework','results','fees','timetable','notices','documents','leave','certificates','transport'] as const;
export type PortalModuleKey=typeof PORTAL_MODULE_KEYS[number];
export type PortalAccessMode='Off'|'ReadOnly'|'Pilot';
export type PortalConfiguration={enabled:boolean;accessMode:PortalAccessMode;modules:Record<PortalModuleKey,boolean>;teacher:{attendance:boolean;homework:boolean;marks:boolean;workLogs:boolean};pwa:{enabled:boolean;installPrompt:boolean;offlineShell:boolean};version:number};

const disabledModules=()=>Object.fromEntries(PORTAL_MODULE_KEYS.map(key=>[key,false])) as Record<PortalModuleKey,boolean>;
export const DEFAULT_PORTAL_CONFIGURATION:PortalConfiguration={enabled:false,accessMode:'Off',modules:disabledModules(),teacher:{attendance:false,homework:false,marks:false,workLogs:false},pwa:{enabled:false,installPrompt:false,offlineShell:false},version:1};

export function normalizePortalConfiguration(value:any):PortalConfiguration{
 const source=value&&typeof value==='object'?value:{},modules=source.modules&&typeof source.modules==='object'?source.modules:{},teacher=source.teacher&&typeof source.teacher==='object'?source.teacher:{},pwa=source.pwa&&typeof source.pwa==='object'?source.pwa:{};
 return{enabled:source.enabled===true,accessMode:['Off','ReadOnly','Pilot'].includes(source.accessMode)?source.accessMode:'Off',modules:Object.fromEntries(PORTAL_MODULE_KEYS.map(key=>[key,modules[key]===true])) as Record<PortalModuleKey,boolean>,teacher:{attendance:teacher.attendance===true,homework:teacher.homework===true,marks:teacher.marks===true,workLogs:teacher.workLogs===true},pwa:{enabled:pwa.enabled===true,installPrompt:pwa.installPrompt===true,offlineShell:pwa.offlineShell===true},version:Number.isInteger(source.version)&&source.version>0?source.version:1}
}

export async function portalConfiguration(db:Queryable,schoolId:string){const row=(await db.query<any>('SELECT settings FROM schools WHERE id=$1',[schoolId])).rows[0];return normalizePortalConfiguration(row?.settings?.portalConfiguration)}
export function effectivePortalMode(serverMode:PortalAccessMode|undefined,configuration:PortalConfiguration):PortalAccessMode{const rank={Off:0,ReadOnly:1,Pilot:2},server=serverMode||'ReadOnly';if(!configuration.enabled)return'Off';return rank[configuration.accessMode]<=rank[server]?configuration.accessMode:server}
