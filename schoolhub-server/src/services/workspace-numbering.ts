import type {Queryable} from '../database/types.js';

export function formatWorkspaceNumber(format:string,number:bigint|number){
 const match=String(format).match(/\{(0{2,12})\}/);
 if(!match)return String(number);
 return String(format).replace(match[0],String(number).padStart(match[1].length,'0'));
}

export async function workspaceNumberFormat(db:Queryable,schoolId:string,workspaceKey:string,fallback:string){
 const row=(await db.query<any>('SELECT record_number_configuration AS configuration FROM workspace_definitions WHERE school_id=$1 AND workspace_key=$2',[schoolId,workspaceKey])).rows[0];
 let configuration=row?.configuration||{};
 try{if(typeof configuration==='string')configuration=JSON.parse(configuration)}catch{configuration={}}
 return configuration.enabled&&configuration.format?String(configuration.format):fallback;
}

export async function nextWorkspaceNumber(db:Queryable,schoolId:string,workspaceKey:string,fallback:string){
 await db.query('INSERT INTO workspace_number_sequences(school_id,workspace_key) VALUES($1,$2) ON CONFLICT(school_id,workspace_key) DO NOTHING',[schoolId,workspaceKey]);
 const row=(await db.query<any>('SELECT next_number FROM workspace_number_sequences WHERE school_id=$1 AND workspace_key=$2 FOR UPDATE',[schoolId,workspaceKey])).rows[0],number=BigInt(row.next_number),format=await workspaceNumberFormat(db,schoolId,workspaceKey,fallback);
 await db.query('UPDATE workspace_number_sequences SET next_number=$1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$2 AND workspace_key=$3',[(number+1n).toString(),schoolId,workspaceKey]);
 return formatWorkspaceNumber(format,number);
}
