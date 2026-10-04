import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {validateAttachmentFile} from './work-logs.js';
import {readHomeworkPicklist} from '../services/homework-picklists.js';
const schema=z.object({title:z.string().trim().min(1).max(240),audience:z.string().trim().max(120),date:z.string().date(),text:z.string().max(10000),expiryDate:z.string().date().nullable(),priority:z.string().max(120),status:z.enum(['Draft','Published']),version:z.number().int().nonnegative(),retainIds:z.array(z.string().min(1).max(120)).max(5),newFiles:z.array(z.object({name:z.string().min(1).max(240),content:z.string().max(14*1024*1024)}).strict()).max(5)}).strict();
export async function registerNoticeWorkspaceRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 for(const method of ['POST','PATCH'] as const)app.route({method,url:'/api/v1/notice-workspace'+(method==='PATCH'?'/:id':''),bodyLimit:72*1024*1024,preHandler:auth(true),handler:async(req,reply)=>{
  const p=req.principal!,editing=method==='PATCH';requirePermission(p,editing?'notices:update':'notices:create');
  const parsed=schema.safeParse(req.body);if(!parsed.success)throw new ApiError('VALIDATION_FAILED','Check notice fields and attachments.',422);const r=parsed.data,id=editing?String((req.params as any).id):randomUUID();
  if(r.status==='Published'&&(!r.audience||!r.text.trim()))throw new ApiError('VALIDATION_FAILED','Audience and message are required to publish.',422);
  if(r.expiryDate&&r.expiryDate<r.date)throw new ApiError('VALIDATION_FAILED','Expiry date cannot be before publish date.',422);
  if(r.retainIds.length+r.newFiles.length>5||new Set(r.retainIds).size!==r.retainIds.length||(!editing&&r.retainIds.length))throw new ApiError('INVALID_ATTACHMENTS','Choose at most five attachments.',422);
  const uploads=r.newFiles.map(validateAttachmentFile);
  await db.transaction(async tx=>{
   const old=editing?(await tx.query<any>('SELECT * FROM school_communications WHERE id=$1 AND school_id=$2 AND archived=false FOR UPDATE',[id,p.schoolId])).rows[0]:null;
   if(editing&&(!old||old.status!=='Published'))throw new ApiError('NOT_FOUND','Notice not found.',404);
   if((old?.version||0)!==r.version)throw new ApiError('RECORD_VERSION_CONFLICT','This notice changed. Reload before saving.',409);
   if(old?.publication_state==='Published'&&r.status==='Draft')throw new ApiError('STATUS_PROTECTED','A published notice cannot be changed back to draft. Archive it instead.',422);
   for(const [key,value,previous]of [['noticeAudience',r.audience,old?.audience],['noticePriority',r.priority,old?.priority]]){
    if(value&&value!==previous&&!(await readHomeworkPicklist(tx,p.schoolId,key)).some(v=>v.active&&v.value===value))throw new ApiError('INVALID_PICKLIST','Choose an active audience or priority.',422);
   }
   const files=(await tx.query<any>('SELECT id FROM notice_files WHERE school_id=$1 AND notice_id=$2 AND archived=false',[p.schoolId,id])).rows;
   if(r.retainIds.some(fid=>!files.some(f=>f.id===fid)))throw new ApiError('INVALID_ATTACHMENTS','Attachment does not belong to this notice.',422);
   if(editing){const changed=await tx.query('UPDATE school_communications SET title=$1,audience=$2,event_date=$3,body=$4,expiry_date=$5,priority=$6,publication_state=$7,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$8 AND school_id=$9 AND version=$10 RETURNING id',[r.title,r.audience,r.date,r.text,r.expiryDate,r.priority,r.status,id,p.schoolId,r.version]);if(!changed.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','This notice changed. Reload before saving.',409)}
   else await tx.query("INSERT INTO school_communications(id,school_id,title,audience,event_date,body,expiry_date,priority,publication_state,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Published',$10)",[id,p.schoolId,r.title,r.audience,r.date,r.text,r.expiryDate,r.priority,r.status,p.userId]);
   for(const f of files)if(!r.retainIds.includes(f.id))await tx.query('UPDATE notice_files SET archived=true WHERE id=$1 AND school_id=$2',[f.id,p.schoolId]);
   for(const f of uploads)await tx.query('INSERT INTO notice_files(id,school_id,notice_id,name,type,size,content) VALUES($1,$2,$3,$4,$5,$6,$7)',[f.id,p.schoolId,id,f.name,f.type,f.size,f.content]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:r.status==='Draft'?'NOTICE_DRAFT_SAVED':'NOTICE_PUBLISHED',entityType:'Communication',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});
  });return reply.code(editing?200:201).send({data:{id}});
 }});
 app.get('/api/v1/notice-files/:id',{preHandler:auth()},async req=>{
  const p=req.principal!;requirePermission(p,'notices:view');
  const f=(await db.query<any>('SELECT f.name,f.type,f.content,n.publication_state,n.created_by FROM notice_files f JOIN school_communications n ON n.id=f.notice_id AND n.school_id=f.school_id WHERE f.id=$1 AND f.school_id=$2 AND f.archived=false AND n.archived=false',[String((req.params as any).id),p.schoolId])).rows[0];
  if(!f)throw new ApiError('NOT_FOUND','Attachment not found.',404);
  if(f.publication_state==='Draft'&&f.created_by!==p.userId)requirePermission(p,'notices:update');
  return{data:{name:f.name,type:f.type,content:f.content}};
 });
}
