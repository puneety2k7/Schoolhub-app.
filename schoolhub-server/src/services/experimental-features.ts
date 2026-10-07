import type {Queryable} from '../database/types.js';
import type {Principal} from '../authorization/service.js';

export type ExperimentalFeatures={gridTabs:boolean;version:number};

export const DEFAULT_EXPERIMENTAL_FEATURES:ExperimentalFeatures={gridTabs:false,version:1};

export function normalizeExperimentalFeatures(value:any):ExperimentalFeatures{
 const source=value&&typeof value==='object'?value:{};
 return{gridTabs:source.gridTabs===true,version:Number.isInteger(source.version)&&source.version>0?source.version:1};
}

export async function experimentalFeatures(db:Queryable,schoolId:string):Promise<ExperimentalFeatures>{
 const row=(await db.query<any>('SELECT settings FROM schools WHERE id=$1',[schoolId])).rows[0];
 return normalizeExperimentalFeatures(row?.settings?.experimentalFeatures);
}

export function mayManageExperimentalFeatures(principal:Pick<Principal,'systemRecovery'>){return principal.systemRecovery===true}

export function gridTabAvailable(features:Pick<ExperimentalFeatures,'gridTabs'>,tabKey:string){return tabKey==='MAIN'||features.gridTabs===true}
