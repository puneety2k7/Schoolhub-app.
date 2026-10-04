import { createHash, randomBytes } from 'node:crypto';
import type { Queryable } from '../database/types.js';
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function createSession(db:Queryable,user:{id:string;school_id:string},ttlMinutes:number,meta:{ip?:string;userAgent?:string}){
  const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url'),expiresAt=new Date(Date.now()+ttlMinutes*60_000);
  await db.query('INSERT INTO sessions(id_hash,user_id,school_id,csrf_hash,expires_at,user_agent,ip_address) VALUES($1,$2,$3,$4,$5,$6,$7)',[digest(token),user.id,user.school_id,digest(csrf),expiresAt,meta.userAgent||null,meta.ip||null]);
  return{token,csrf,expiresAt};
}
export async function revokeSession(db:Queryable,token:string){await db.query('DELETE FROM sessions WHERE id_hash=$1',[digest(token)]);}
export async function revokeOtherSessions(db:Queryable,userId:string,currentToken:string){await db.query('DELETE FROM sessions WHERE user_id=$1 AND id_hash<>$2',[userId,digest(currentToken)]);}
export async function rotateCsrf(db:Queryable,token:string){const csrf=randomBytes(24).toString('base64url');await db.query('UPDATE sessions SET csrf_hash=$1 WHERE id_hash=$2',[digest(csrf),digest(token)]);return csrf;}
