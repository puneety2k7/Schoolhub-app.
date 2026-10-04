import {authorizeArchivedLifecycle} from '../authorization/policy-engine.js';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Queryable} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission,type Principal} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
const event=z.object({title:z.string().trim().min(1).max(240),type:z.string().min(1).max(80),category:z.string().max(120),from:z.string().date(),to:z.string().date(),allDay:z.boolean(),description:z.string().max(10000),audience:z.string().trim().min(1).max(120),isHoliday:z.boolean()}).strict().refine(x=>x.to>=x.from,{message:'End date cannot be before start date.',path:['to']});
const version=z.number().int().min(0);
function parse<T>(schema:z.ZodType<T>,input:unknown):T{const r=schema.safeParse(input);if(!r.success)throw new ApiError('VALIDATION_FAILED',r.error.issues.map(x=>x.message).join(' '),422,{fields:r.error.issues.map(x=>x.path.join('.'))});return r.data;}
function preloaded(id:string){const m=/^pre-(20[2-7][0-9])-(\d{1,2})$/.exec(id);return !!m&&Number(m[1])>=2026&&Number(m[1])<=2075&&Number(m[2])<18;}
export async function existing(tx:Queryable,p:Principal,id:string,expected:number){
 if(preloaded(id))await tx.query("INSERT INTO school_calendar_events(school_id,id,data,version) VALUES($1,$2,'{}',0) ON CONFLICT(school_id,id) DO NOTHING",[p.schoolId,id]);
 const row=(await tx.query<any>('SELECT * FROM school_calendar_events WHERE school_id=$1 AND id=$2 FOR UPDATE',[p.schoolId,id])).rows[0];
 if(!row)throw new ApiError('NOT_FOUND','Calendar event not found.',404);
 if(row.version!==expected)throw new ApiError('RECORD_VERSION_CONFLICT','This calendar event changed. Refresh and try again.',409);
 return row;
}
const columns='id,data,hidden,notice_id AS "noticeId",version';
export async function registerCalendarRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 app.get('/api/v1/calendar-events',{preHandler:auth()},async req=>{const p=req.principal!;requirePermission(p,'calendar:view');return {data:{items:(await db.query('SELECT '+columns+' FROM school_calendar_events WHERE school_id=$1',[p.schoolId])).rows}};});
 app.post('/api/v1/calendar-events',{preHandler:auth(true)},async(req,reply)=>{
  const p=req.principal!;requirePermission(p,'calendar:create');const input=parse(event,req.body);
  const row=await db.transaction(async tx=>{
   const r=await tx.query('INSERT INTO school_calendar_events(school_id,id,data,version) VALUES($1,$2,$3,1) RETURNING '+columns,[p.schoolId,randomUUID(),JSON.stringify(input)]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'CALENDAR_CREATED',entityType:'Calendar',outcome:'SUCCESS',correlationId:req.correlationId});return r.rows[0];
  });return reply.code(201).send({data:row});
 });
 app.patch('/api/v1/calendar-events/:id',{preHandler:auth(true)},async req=>{
  const p=req.principal!;requirePermission(p,'calendar:update');const input=parse(z.object({event,version}).strict(),req.body),id=String((req.params as any).id);
  const row=await db.transaction(async tx=>{const old=await existing(tx,p,id,input.version);if(old.hidden)throw new ApiError('NOT_FOUND','This event is hidden or deleted.',404);if(Array.isArray(old.data.audiences))throw new ApiError('CALENDAR_WORKSPACE_REQUIRED','Edit this event through the Calendar workspace to preserve its audience and reference fields.',409);
   const r=await tx.query('UPDATE school_calendar_events SET data=$1,version=version+1 WHERE school_id=$2 AND id=$3 RETURNING '+columns,[JSON.stringify({...old.data,...input.event}),p.schoolId,id]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'CALENDAR_UPDATED',entityType:'Calendar',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});return r.rows[0];
  });return {data:row};
 });
 for(const action of ['remove','restore'] as const)app.post('/api/v1/calendar-events/:id/'+action,{preHandler:auth(true)},async req=>{
  const p=req.principal!;if(action==='remove')requirePermission(p,'calendar:delete');const input=parse(z.object({version}).strict(),req.body),id=String((req.params as any).id);
  if(action==='restore'&&!preloaded(id))throw new ApiError('VALIDATION_FAILED','Only preloaded holidays can be restored.',422);
  const row=await db.transaction(async tx=>{const old=await existing(tx,p,id,input.version);if(action==='restore')await authorizeArchivedLifecycle(tx,p,'record.restore',{schoolId:p.schoolId,workspaceKey:'calendar-holidays',resourceType:'calendar-event',recordId:id,lifecycle:old.hidden?'Archived':'Active'});
   const r=await tx.query('UPDATE school_calendar_events SET hidden=$1,version=version+1 WHERE school_id=$2 AND id=$3 RETURNING '+columns,[action==='remove',p.schoolId,id]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:action==='remove'?'CALENDAR_REMOVED':'CALENDAR_RESTORED',entityType:'Calendar',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});return r.rows[0];
  });return {data:row};
 });
 app.post('/api/v1/calendar-events/:id/notice',{preHandler:auth(true)},async(req,reply)=>{
  const p=req.principal!;requirePermission(p,'calendar:view');requirePermission(p,'notices:create');
  const input=parse(z.object({version,notice:z.object({title:z.string().trim().min(1).max(240),date:z.string().date(),audience:z.string().trim().min(1).max(120),text:z.string().max(10000),status:z.literal('Published')}).strict()}).strict(),req.body),id=String((req.params as any).id);
  const result=await db.transaction(async tx=>{const old=await existing(tx,p,id,input.version);if(old.hidden)throw new ApiError('NOT_FOUND','Calendar event is unavailable.',404);
   if(old.notice_id&&(await tx.query('SELECT id FROM school_communications WHERE id=$1 AND school_id=$2 AND archived=false',[old.notice_id,p.schoolId])).rows.length)throw new ApiError('VALIDATION_FAILED','This event already has a linked notice.',409);
   const n=input.notice,noticeId=randomUUID();
   await tx.query("INSERT INTO school_communications(id,school_id,event_date,title,audience,body,status,created_by,source_event_id) VALUES($1,$2,$3,$4,$5,$6,'Published',$7,$8)",[noticeId,p.schoolId,n.date,n.title,n.audience,n.text,p.userId,id]);
   const changed=await tx.query('UPDATE school_calendar_events SET notice_id=$1,version=version+1 WHERE school_id=$2 AND id=$3 RETURNING '+columns,[noticeId,p.schoolId,id]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'CALENDAR_NOTICE_CREATED',entityType:'Calendar',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});
   return {event:changed.rows[0],notice:{...n,id:noticeId,version:1,sourceEventId:id}};
  });return reply.code(201).send({data:result});
 });
}
