import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config/index.js';
import type { Queryable } from '../database/types.js';
import type { Principal } from '../authorization/service.js';
import { permissionsForUser } from '../authorization/access-control.js';
import { ApiError } from '../errors/api-error.js';
import { digest } from './sessions.js';

export async function authenticate(req:FastifyRequest,db:Queryable,config:AppConfig,csrf=false):Promise<Principal>{
  const token=req.cookies[config.cookieName];
  if(!token)throw new ApiError('AUTHENTICATION_REQUIRED','Authentication is required.',401);
  const result=await db.query<any>(`SELECT s.id_hash,s.csrf_hash,s.expires_at,u.id AS user_id,u.school_id,u.role_id,u.teacher_id,u.student_id,u.username,u.status,r.name AS role_name,r.system AS role_system
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id WHERE s.id_hash=$1`,[digest(token)]);
  const row=result.rows[0];if(!row)throw new ApiError('AUTHENTICATION_REQUIRED','Authentication is required.',401);
  if(new Date(row.expires_at).getTime()<=Date.now()){await db.query('DELETE FROM sessions WHERE id_hash=$1',[row.id_hash]);throw new ApiError('SESSION_EXPIRED','Your session has expired. Please sign in again.',401);}
  if(row.status!=='Active')throw new ApiError('ACCOUNT_DISABLED','This account is disabled.',403);
  if(csrf){const supplied=String(req.headers['x-csrf-token']||'');if(!supplied||digest(supplied)!==row.csrf_hash)throw new ApiError('CSRF_VALIDATION_FAILED','The request could not be verified.',403);}

  const guardian=await db.query<any>('SELECT guardian_id FROM user_guardian_links WHERE user_id=$1 AND school_id=$2',[row.user_id,row.school_id]);
  const base={userId:row.user_id,schoolId:row.school_id,roleId:row.role_id,roleName:row.role_name,systemRecovery:row.role_system===true,teacherId:row.teacher_id||null,studentId:row.student_id||null,guardianId:guardian.rows[0]?.guardian_id||null,username:row.username,permissions:[] as string[]};const effective=await permissionsForUser(db,base);const principal={...base,permissions:effective.permissions,accessControlMode:effective.mode};
  req.principal=principal;req.sessionToken=token;req.sessionCsrfHash=row.csrf_hash;await db.query('UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id_hash=$1',[row.id_hash]);return principal;
}
export function setSessionCookie(reply:FastifyReply,config:AppConfig,token:string,expires:Date){reply.setCookie(config.cookieName,token,{httpOnly:true,secure:config.nodeEnv==='production',sameSite:'strict',path:'/',expires});}
export function clearSessionCookie(reply:FastifyReply,config:AppConfig){reply.clearCookie(config.cookieName,{httpOnly:true,secure:config.nodeEnv==='production',sameSite:'strict',path:'/'});}
