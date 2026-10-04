import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Queryable} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import sanitizeHtml from 'sanitize-html';
export const RESOURCE_CATALOG_SCHEMA=`
CREATE TABLE IF NOT EXISTS school_resource_catalogs(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),
 kind text NOT NULL CHECK(kind IN ('uniform','curriculum')),
 record_key text NOT NULL,class_id text REFERENCES classes(id),data jsonb NOT NULL,
 archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS school_resource_unique ON school_resource_catalogs(school_id,kind,record_key) WHERE archived=false;
CREATE INDEX IF NOT EXISTS school_resource_scope ON school_resource_catalogs(school_id,kind,archived);
`;
const kindSchema=z.enum(['uniform','curriculum']);
const base={description:z.string().max(200000),image:z.string().max(14*1024*1024),document:z.string().max(14*1024*1024),documentName:z.string().max(240)};
const schemas={uniform:z.object({...base,name:z.string().trim().min(1).max(160)}).strict(),curriculum:z.object({...base,class:z.string().trim().min(1).max(160),subjects:z.string().max(4000)}).strict()};
function parse<T>(schema:z.ZodType<T>,input:unknown):T{const r=schema.safeParse(input);if(!r.success)throw new ApiError('VALIDATION_FAILED','Check the supplied fields.',422,{fields:r.error.issues.map(x=>x.path.join('.'))});return r.data;}
function attachment(value:string,image:boolean){
 if(!value)return;
 const match=/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match||image!==match[1].startsWith('image/'))throw new ApiError('VALIDATION_FAILED',image?'Select a JPEG, PNG or WebP image.':'Select a PDF document.',422);
 const bytes=Buffer.from(match[2],'base64');if(bytes.length>10*1024*1024)throw new ApiError('VALIDATION_FAILED','Each attachment must be 10 MB or smaller.',422);
 const valid=match[1]==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':match[1]==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 if(!valid)throw new ApiError('VALIDATION_FAILED','The attachment does not match its file type.',422);
}
async function clean(tx:Queryable,schoolId:string,kind:'uniform'|'curriculum',input:unknown){
 const data=parse(schemas[kind] as z.ZodType<any>,input);attachment(data.image,true);attachment(data.document,false);
 data.description=sanitizeHtml(data.description);if(!data.document)data.documentName='';
 let classId:string|null=null,key=data.name?.toLowerCase();
 if(kind==='curriculum'){
  const rows=(await tx.query<{id:string,name:string}>('SELECT id,name FROM classes WHERE school_id=$1 AND name=$2 AND active=true',[schoolId,data.class])).rows;
  if(rows.length!==1)throw new ApiError('VALIDATION_FAILED','Select an active school class.',422);
  classId=rows[0].id;key=classId;data.class=rows[0].name;
 }
 return {data,classId,key};
}
export async function registerResourceCatalogRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 app.get('/api/v1/resource-catalogs/:kind',{preHandler:auth()},async req=>{
  const p=req.principal!,kind=parse(kindSchema,(req.params as any).kind);requirePermission(p,kind+':view');
  const items=(await db.query<any>('SELECT r.id,r.data,r.version,c.name AS class_name FROM school_resource_catalogs r LEFT JOIN classes c ON c.id=r.class_id AND c.school_id=r.school_id WHERE r.school_id=$1 AND r.kind=$2 AND r.archived=false ORDER BY r.created_at,r.id',[p.schoolId,kind])).rows;
  const classes=kind==='curriculum'?(await db.query('SELECT id,name FROM classes WHERE school_id=$1 AND active=true ORDER BY name',[p.schoolId])).rows:[];
  const subjects=kind==='curriculum'?(await db.query('SELECT id,name,code FROM subjects WHERE school_id=$1 AND active=true ORDER BY name',[p.schoolId])).rows:[];
  return {data:{classes,subjects,items:items.map(r=>({id:r.id,version:r.version,data:kind==='curriculum'?{...r.data,class:r.class_name}:r.data}))}};
 });
 for(const method of ['POST','PATCH'] as const)app.route({method,bodyLimit:30*1024*1024,url:'/api/v1/resource-catalogs/:kind'+(method==='PATCH'?'/:id':''),preHandler:auth(true),handler:async(req,reply)=>{
  const p=req.principal!,kind=parse(kindSchema,(req.params as any).kind),editing=method==='PATCH';requirePermission(p,kind+(editing?':update':':create'));
  const input=editing?parse(z.object({data:z.unknown(),version:z.number().int().positive()}).strict(),req.body):{data:req.body,version:0},id=editing?String((req.params as any).id):randomUUID();
  try{
   const result=await db.transaction(async tx=>{
    const {data,key,classId}=await clean(tx,p.schoolId,kind,input.data);
    const row=editing?await tx.query('UPDATE school_resource_catalogs SET data=$1,record_key=$2,class_id=$3,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$4 AND school_id=$5 AND kind=$6 AND version=$7 AND archived=false RETURNING id,data,version',[JSON.stringify(data),key,classId,id,p.schoolId,kind,input.version]):await tx.query('INSERT INTO school_resource_catalogs(id,school_id,kind,record_key,class_id,data) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,data,version',[id,p.schoolId,kind,key,classId,JSON.stringify(data)]);
    if(!row.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','This record changed or is unavailable. Refresh before editing.',409);
    await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:editing?'RESOURCE_UPDATED':'RESOURCE_CREATED',entityType:kind,entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});return row.rows[0];
   });return reply.code(editing?200:201).send({data:result});
  }catch(e:any){if(e.code==='23505')throw new ApiError('DUPLICATE_RECORD',kind==='uniform'?'A category with this name already exists.':'This class already has a curriculum entry.',409);throw e;}
 }});
 app.post('/api/v1/resource-catalogs/:kind/:id/remove',{preHandler:auth(true)},async req=>{
  const p=req.principal!,kind=parse(kindSchema,(req.params as any).kind),id=String((req.params as any).id);requirePermission(p,kind+':delete');
  const {version}=parse(z.object({version:z.number().int().positive()}).strict(),req.body);
  await db.transaction(async tx=>{
   const row=await tx.query('UPDATE school_resource_catalogs SET archived=true,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND school_id=$2 AND kind=$3 AND version=$4 AND archived=false RETURNING id',[id,p.schoolId,kind,version]);if(!row.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','This record changed or is unavailable. Refresh the list.',409);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'RESOURCE_REMOVED',entityType:kind,entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});
  });return {data:{removed:true}};
 });
}
