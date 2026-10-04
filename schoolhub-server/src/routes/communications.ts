import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database } from '../database/types.js';
import type { AppConfig } from '../config/index.js';
import { authenticate } from '../auth/security.js';
import { requirePermission } from '../authorization/service.js';
import { ApiError } from '../errors/api-error.js';
import { writeAudit } from '../audit/service.js';

const notice=z.object({
 date:z.string().date(),title:z.string().trim().min(1).max(240),
 audience:z.string().trim().min(1).max(120),text:z.string().max(10000),
 status:z.enum(['Published','Calendar'])
}).strict();
const update=notice.extend({version:z.number().int().positive()});
function parse<T>(schema:z.ZodType<T>,body:unknown):T{
 const result=schema.safeParse(body);
 if(!result.success)throw new ApiError('VALIDATION_FAILED','Check the highlighted fields.',422,{fields:result.error.issues.map(x=>x.path.join('.'))});
 return result.data;
}
const columns='id,event_date AS date,title,audience,body AS text,status,version,source_event_id AS "sourceEventId"';
export async function registerCommunicationRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 app.get('/api/v1/communications',{preHandler:auth()},async req=>{
  const p=req.principal!;
  const canRead=(permission:string)=>p.systemRecovery===true||p.permissions.includes(permission);
  if(!canRead('notices:view')&&!canRead('calendar:view'))requirePermission(p,'notices:view');
  const statuses=canRead('notices:view')?['Published','Calendar']:['Calendar'];
  const rows=await db.query('SELECT '+columns+' FROM school_communications WHERE school_id=$1 AND archived=false AND publication_state=\'Published\' AND (expiry_date IS NULL OR expiry_date >= $3) AND status=ANY($2::text[]) ORDER BY event_date DESC,id',[p.schoolId,statuses,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})]);
  return {data:{items:rows.rows}};
 });
 app.post('/api/v1/communications',{preHandler:auth(true)},async(req,reply)=>{
  const p=req.principal!,input=parse(notice,req.body);
  requirePermission(p,input.status==='Calendar'?'calendar:create':'notices:create');
  const row=await db.transaction(async tx=>{
   const result=await tx.query('INSERT INTO school_communications(id,school_id,event_date,title,audience,body,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING '+columns,[randomUUID(),p.schoolId,input.date,input.title,input.audience,input.text,input.status,p.userId]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'COMMUNICATION_CREATED',entityType:'Communication',correlationId:req.correlationId,outcome:'SUCCESS'});
   return result.rows[0];
  });
  return reply.code(201).send({data:row});
 });
 app.patch('/api/v1/communications/:id',{preHandler:auth(true)},async req=>{
  const p=req.principal!,input=parse(update,req.body),id=String((req.params as any).id);
  const row=await db.transaction(async tx=>{
   const old=(await tx.query<any>('SELECT status,version FROM school_communications WHERE id=$1 AND school_id=$2 AND archived=false',[id,p.schoolId])).rows[0];
   if(!old)throw new ApiError('NOT_FOUND','Notice or event not found.',404);
   requirePermission(p,old.status==='Calendar'?'calendar:update':'notices:update');
   if(input.status!==old.status)throw new ApiError('STATUS_PROTECTED','The notice/event type cannot be changed.',422);
   const result=await tx.query('UPDATE school_communications SET event_date=$1,title=$2,audience=$3,body=$4,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$5 AND school_id=$6 AND version=$7 AND archived=false RETURNING '+columns,[input.date,input.title,input.audience,input.text,id,p.schoolId,input.version]);
   if(!result.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','This record changed. Refresh before saving.',409);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'COMMUNICATION_UPDATED',entityType:'Communication',entityId:id,correlationId:req.correlationId,outcome:'SUCCESS'});
   return result.rows[0];
  });
  return {data:row};
 });
 app.post('/api/v1/communications/:id/archive',{preHandler:auth(true)},async req=>{
  const p=req.principal!,input=parse(z.object({version:z.number().int().positive()}).strict(),req.body),id=String((req.params as any).id);
  await db.transaction(async tx=>{
   const old=(await tx.query<any>('SELECT status FROM school_communications WHERE id=$1 AND school_id=$2 AND archived=false',[id,p.schoolId])).rows[0];
   if(!old)throw new ApiError('NOT_FOUND','Notice or event not found.',404);
   requirePermission(p,old.status==='Calendar'?'calendar:delete':'notices:delete');
   const changed=await tx.query('UPDATE school_communications SET archived=true,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND school_id=$2 AND version=$3 AND archived=false RETURNING id',[id,p.schoolId,input.version]);
   if(!changed.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','This record changed. Refresh before archiving.',409);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'COMMUNICATION_ARCHIVED',entityType:'Communication',entityId:id,correlationId:req.correlationId,outcome:'SUCCESS'});
  });
  return {data:{archived:true}};
 });
}

