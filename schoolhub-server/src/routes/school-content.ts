import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import sanitizeHtml from 'sanitize-html';
import {documentStaffOnly,documentData} from './document-workspace.js';
const kinds=z.enum(['documents','rules']);
const schemas={
 documents:z.object({name:z.string().trim().min(1).max(240),cat:z.string().max(120),aud:z.string().max(120),date:z.string().date()}).strict(),
 rules:z.object({html:z.string().max(200000)}).strict()
};
function parse<T>(schema:z.ZodType<T>,input:unknown):T{const result=schema.safeParse(input);if(!result.success)throw new ApiError('VALIDATION_FAILED','Check the supplied fields.',422,{fields:result.error.issues.map(x=>x.path.join('.'))});return result.data;}
function clean(kind:'documents'|'rules',value:unknown):any{
 const data=parse(schemas[kind] as z.ZodType<any>,value);
 if(kind==='rules')data.html=sanitizeHtml(data.html,{
  allowedTags:sanitizeHtml.defaults.allowedTags.concat(['img']),
  allowedAttributes:{...sanitizeHtml.defaults.allowedAttributes,'*':['style','class'],img:['src','alt','width','height'],table:['border','cellpadding','cellspacing']},
  allowedStyles:{'*':{'color':[/^[#\w\s(),.%+-]+$/],'background-color':[/^[#\w\s(),.%+-]+$/],'text-align':[/^(left|right|center|justify)$/],'font-size':[/^[\d.]+(px|pt|em|rem|%)$/],'font-weight':[/^(normal|bold|[1-9]00)$/]}}
 });
 return data;
}
const columns='id,data,version';
export async function registerSchoolContentRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 app.get('/api/v1/school-content/:kind',{preHandler:auth()},async req=>{
  const p=req.principal!,kind=parse(kinds,(req.params as any).kind);requirePermission(p,kind+':view');
  const rows=(await db.query<any>('SELECT * FROM school_content_records WHERE school_id=$1 AND kind=$2 AND archived=false ORDER BY created_at,id',[p.schoolId,kind])).rows;
  if(kind==='documents'){documentStaffOnly(p);return {data:{items:rows.filter(x=>x.data.status!=='Draft'||x.data.createdBy===p.userId||p.systemRecovery===true||p.permissions.includes('documents:update')).map(x=>({id:x.id,version:x.version,data:documentData(x,p)}))}}}
  return {data:{items:rows.map(x=>({id:x.id,data:x.data,version:x.version}))}};
 });
 app.post('/api/v1/school-content/:kind',{preHandler:auth(true)},async(req,reply)=>{
  const p=req.principal!,kind=parse(kinds,(req.params as any).kind);requirePermission(p,kind+(kind==='rules'?':update':':create'));const data=clean(kind,req.body),id=randomUUID();
  try{
   const result=await db.transaction(async tx=>{
    const row=await tx.query('INSERT INTO school_content_records(id,school_id,kind,record_key,data) VALUES($1,$2,$3,$4,$5) RETURNING '+columns,[id,p.schoolId,kind,kind==='rules'?'rules':id,JSON.stringify(data)]);
    await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'CONTENT_CREATED',entityType:kind,entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});return row.rows[0];
   });return reply.code(201).send({data:result});
  }catch(e:any){if(e.code==='23505')throw new ApiError('RECORD_VERSION_CONFLICT','Content was created on another device. Refresh before editing.',409);throw e;}
 });
 app.patch('/api/v1/school-content/:kind/:id',{preHandler:auth(true)},async req=>{
  const p=req.principal!,kind=parse(kinds,(req.params as any).kind),id=String((req.params as any).id);requirePermission(p,kind+':update');
  const input=parse(z.object({data:z.unknown(),version:z.number().int().positive()}).strict(),req.body),data=clean(kind,input.data);
  const result=await db.transaction(async tx=>{
   const old=(await tx.query<any>('SELECT id,data FROM school_content_records WHERE id=$1 AND school_id=$2 AND kind=$3 AND archived=false',[id,p.schoolId,kind])).rows[0];if(!old)throw new ApiError('NOT_FOUND','Content not found.',404);
   if(kind==='documents'&&old.data.audiences)throw new ApiError('DOCUMENT_WORKSPACE_REQUIRED','Use the updated Documents workspace to preserve its fields.',409);
   const row=await tx.query('UPDATE school_content_records SET data=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND school_id=$3 AND kind=$4 AND version=$5 AND archived=false RETURNING '+columns,[JSON.stringify(data),id,p.schoolId,kind,input.version]);
   if(!row.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','This content changed. Refresh before saving.',409);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'CONTENT_UPDATED',entityType:kind,entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});return row.rows[0];
  });return {data:result};
 });
 app.post('/api/v1/school-content/:kind/:id/remove',{preHandler:auth(true)},async req=>{
  const p=req.principal!,kind=parse(kinds,(req.params as any).kind),id=String((req.params as any).id);if(kind==='rules')throw new ApiError('VALIDATION_FAILED','Edit the rules instead of deleting the section.',422);requirePermission(p,kind+':delete');
  const input=parse(z.object({version:z.number().int().positive()}).strict(),req.body);
  await db.transaction(async tx=>{
   const changed=await tx.query('UPDATE school_content_records SET archived=true,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND school_id=$2 AND kind=$3 AND version=$4 AND archived=false RETURNING id',[id,p.schoolId,kind,input.version]);
   if(!changed.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','This content changed or is unavailable. Refresh the list.',409);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'CONTENT_REMOVED',entityType:kind,entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});
  });return {data:{removed:true}};
 });
}

