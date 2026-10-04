import type {FastifyInstance,FastifyRequest} from 'fastify';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {AppConfig} from '../config/index.js';
import type {Database,Queryable} from '../database/types.js';
import {authenticate} from '../auth/security.js';
import {requirePermission,assertTeacherStudentScope,type Principal} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {ensureHomeworkPicklists} from '../services/homework-picklists.js';
import {SYSTEM_PICKLISTS,defaultPicklistColor,markSystemPicklists} from '../services/picklist-display.js';
const key=z.string().regex(/^[a-z][A-Za-z0-9]{1,79}$/),color=z.string().regex(/^(green|red|amber|blue|purple|gray|teal|#[0-9a-fA-F]{6})$/);
const value=z.object({id:z.string().max(120).optional(),value:z.string().trim().min(1).max(200),label:z.string().trim().min(1).max(200),color:color.optional(),filterValue:z.string().max(200).nullable().optional(),active:z.boolean().optional()}).strict();
const common={picklistKey:key,name:z.string().trim().min(2).max(120),description:z.string().max(500).default('')};
const admin=z.object({...common,sourceType:z.literal('AdminDefined'),values:z.array(value).min(1).max(1000)}).strict();
const workspace=z.object({...common,sourceType:z.literal('Workspace'),workspaceId:z.string().min(1).max(120),valueFieldKey:key,labelFieldKey:key,filterFieldKey:key.nullable().optional()}).strict();
const creation=z.discriminatedUnion('sourceType',[admin,workspace]),update=z.object({name:z.string().trim().min(2).max(120),description:z.string().max(500),version:z.number().int().positive(),values:z.array(value).min(1).max(1000).optional()}).strict();
function parse<T>(schema:z.ZodType<T>,body:unknown):T{const r=schema.safeParse(body);if(!r.success)throw new ApiError('VALIDATION_FAILED','Check the Picklist fields and colors.',422,{fields:r.error.issues.map(i=>i.path.join('.'))});return r.data}
function principal(req:FastifyRequest):Principal{if(!req.principal)throw new ApiError('AUTHENTICATION_REQUIRED','Authentication is required.',401);return req.principal}
const columns='id,picklist_key AS "picklistKey",name,description,source_type AS "sourceType",is_system AS "isSystem",workspace_id AS "workspaceId",value_field_key AS "valueFieldKey",label_field_key AS "labelFieldKey",filter_field_key AS "filterFieldKey",active,version,created_at AS "createdAt",updated_at AS "updatedAt"';
const valueColumns='id,value,label,color,filter_value AS "filterValue",sort_order AS "order",active,version';
async function replaceValues(tx:Queryable,p:Principal,id:string,values:z.infer<typeof value>[],validateOnly=false){
 if(new Set(values.map(x=>x.value.toLowerCase())).size!==values.length)throw new ApiError('DUPLICATE_PICKLIST_VALUE','Picklist values must be unique.',422);
 const list=(await tx.query<any>('SELECT picklist_key FROM picklist_definitions WHERE id=$1 AND school_id=$2',[id,p.schoolId])).rows[0],required=SYSTEM_PICKLISTS[list.picklist_key]||[],old=(await tx.query<any>('SELECT * FROM picklist_values WHERE picklist_id=$1 AND school_id=$2',[id,p.schoolId])).rows;
 for(const code of required)if(!values.some(x=>x.value===code&&x.active!==false))throw new ApiError('SYSTEM_VALUE_PROTECTED','Required system values must remain present and active. Change labels or colors instead.',422);
 const ids=values.filter(x=>x.id).map(x=>x.id);if(new Set(ids).size!==ids.length)throw new ApiError('DUPLICATE_PICKLIST_VALUE','Duplicate value row.',422);
 for(const x of values)if(x.id&&!old.some(v=>v.id===x.id&&v.value===x.value))throw new ApiError('STABLE_PICKLIST_VALUE','Stored values cannot be renamed. Deactivate the old value and add a new one.',422);
 if(validateOnly)return;
 for(let order=0;order<values.length;order++){
  const x=values[order],prior=x.id?old.find(v=>v.id===x.id):old.find(v=>v.value===x.value);
  if(x.id&&(!prior||prior.value!==x.value))throw new ApiError('STABLE_PICKLIST_VALUE','Stored values cannot be renamed. Deactivate the old value and add a new one.',422);
  if(prior)await tx.query('UPDATE picklist_values SET label=$1,color=$2,filter_value=$3,sort_order=$4,active=$5,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$6 AND school_id=$7',[x.label,x.color||prior.color||defaultPicklistColor(x.value),x.filterValue||null,order,x.active!==false,prior.id,p.schoolId]);
  else await tx.query('INSERT INTO picklist_values(id,school_id,picklist_id,value,label,color,filter_value,sort_order,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[randomUUID(),p.schoolId,id,x.value,x.label,x.color||defaultPicklistColor(x.value),x.filterValue||null,order,x.active!==false]);
 }
 // Never physically delete choices: old records and legacy custom fields can refer to their codes.
 for(const x of old)if(!values.some(v=>v.value===x.value))await tx.query('UPDATE picklist_values SET active=false,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND school_id=$2',[x.id,p.schoolId]);
}
async function definition(db:Queryable,p:Principal,id:string){
 const row=(await db.query<any>('SELECT '+columns+' FROM picklist_definitions WHERE id=$1 AND school_id=$2',[id,p.schoolId])).rows[0];if(!row)throw new ApiError('PICKLIST_NOT_FOUND','Picklist not found.',404);
 const values=row.sourceType==='AdminDefined'?(await db.query<any>('SELECT '+valueColumns+' FROM picklist_values WHERE picklist_id=$1 AND school_id=$2 ORDER BY sort_order,id',[id,p.schoolId])).rows:[];
 return{...row,sourceType:row.isSystem?'System':row.sourceType,values:values.map(v=>({...v,required:(SYSTEM_PICKLISTS[row.picklistKey]||[]).includes(v.value)}))};
}
export const PICKLIST_WORKSPACE_SOURCES={
 students:{table:'students',fields:{id:'id',admissionNumber:'admission_number',name:'name',status:'status',classId:'class_id',sectionId:'section_id'},active:"status='Active'"},
 staff:{table:'staff',fields:{id:'id',employeeNumber:'employee_number',name:'name',status:'status'},active:"status='Active'"},
 classes:{table:'classes',fields:{id:'id',name:'name',active:'active'},active:'active=true'}
};
export async function workspaceValues(db:Queryable,p:Principal,row:any){
 const w=(await db.query<any>('SELECT workspace_key AS "workspaceKey" FROM workspace_definitions WHERE id=$1 AND school_id=$2 AND status<>$3',[row.workspaceId,p.schoolId,'Archived'])).rows[0];if(!w)throw new ApiError('PICKLIST_WORKSPACE_UNAVAILABLE','Source Workspace is unavailable.',409);
 const adapter=(PICKLIST_WORKSPACE_SOURCES as any)[w.workspaceKey],v=adapter?.fields[row.valueFieldKey],l=adapter?.fields[row.labelFieldKey],f=row.filterFieldKey?adapter?.fields[row.filterFieldKey]:null;
 if(!adapter||!v||!l||row.filterFieldKey&&!f)throw new ApiError('PICKLIST_WORKSPACE_SOURCE_UNSUPPORTED','Choose mapped fields from Students, Teachers & Staff, or Classes.',422);
 const records=(await db.query<any>('SELECT * FROM '+adapter.table+' WHERE school_id=$1 AND '+adapter.active+' ORDER BY '+l+' LIMIT 1000',[p.schoolId])).rows,items=[];
 for(const r of records){
  if(!!p.teacherId){if(w.workspaceKey==='students'){try{await assertTeacherStudentScope(db,p,r)}catch(e){if(e instanceof ApiError&&e.status===403)continue;throw e}}else if(w.workspaceKey==='staff'&&r.id!==p.teacherId)continue;else if(w.workspaceKey==='classes'){const match=(await db.query('SELECT id FROM teacher_assignments WHERE school_id=$1 AND teacher_id=$2 AND class_id=$3 AND active=true',[p.schoolId,p.teacherId,r.id])).rows[0];if(!match)continue}}
  items.push({value:String(r[v]??''),label:String(r[l]??''),filterValue:f?String(r[f]??''):null});
 }return items;
}
export async function registerPicklistRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write),audit=(tx:Queryable,p:Principal,req:FastifyRequest,action:string,id:string)=>writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action,entityType:'Picklist',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});
 app.get('/api/v1/picklists',{preHandler:auth()},async req=>{
  const p=principal(req);requirePermission(p,'workspaces:view');await ensureHomeworkPicklists(db,p.schoolId);await markSystemPicklists(db,p.schoolId);
  const ids=(await db.query<any>('SELECT id FROM picklist_definitions WHERE school_id=$1 AND active=true ORDER BY name,id',[p.schoolId])).rows,items=[];for(const x of ids)items.push(await definition(db,p,x.id));
  return{data:{items,workspaceSources:Object.keys(PICKLIST_WORKSPACE_SOURCES),sourceFields:Object.fromEntries(Object.entries(PICKLIST_WORKSPACE_SOURCES).map(([k,v])=>[k,Object.keys(v.fields)]))}};
 });
 app.get('/api/v1/picklist-display',{preHandler:auth()},async req=>{
  const p=principal(req),access:Record<string,string>={attendanceStatus:'attendance:view',studentStatus:'students:view',leaveStatus:'leave:view',homeworkStatus:'homework:view',calendarStatus:'calendar:view',calendarEventType:'calendar:view',documentStatus:'documents:view',noticeStatus:'notices:view',classStatus:'classes:view'};
  const rows=(await db.query<any>("SELECT d.picklist_key AS key,v.value,v.label,v.color,v.active FROM picklist_values v JOIN picklist_definitions d ON d.id=v.picklist_id AND d.school_id=v.school_id WHERE d.school_id=$1 AND d.active=true AND d.source_type='AdminDefined' ORDER BY v.sort_order,v.id",[p.schoolId])).rows;
  return{data:{items:rows.filter(v=>p.systemRecovery===true||p.permissions.includes('workspaces:view')||access[v.key]&&p.permissions.includes(access[v.key]))}};
 });
 app.get('/api/v1/picklists/:id/values',{preHandler:auth()},async req=>{const p=principal(req);requirePermission(p,'workspaces:view');const row=await definition(db,p,String((req.params as any).id));return{data:{items:row.sourceType==='Workspace'?await workspaceValues(db,p,row):row.values.filter((v:any)=>v.active)}}});
 app.post('/api/v1/picklists',{preHandler:auth(true)},async(req,reply)=>{
  const p=principal(req);requirePermission(p,'workspaces:configure');const input=parse(creation,req.body),id=randomUUID();
  if(SYSTEM_PICKLISTS[input.picklistKey])throw new ApiError('SYSTEM_KEY_RESERVED','This key belongs to a built-in system Picklist.',422);
  const result=await db.transaction(async tx=>{
   if(input.sourceType==='Workspace'){if(input.valueFieldKey!=='id')throw new ApiError('STABLE_RECORD_ID_REQUIRED','New Workspace-backed Picklists must store the record ID.',422);await workspaceValues(tx,p,input)}
   await tx.query('INSERT INTO picklist_definitions(id,school_id,picklist_key,name,description,source_type,workspace_id,value_field_key,label_field_key,filter_field_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,p.schoolId,input.picklistKey,input.name,input.description,input.sourceType,input.sourceType==='Workspace'?input.workspaceId:null,input.sourceType==='Workspace'?input.valueFieldKey:null,input.sourceType==='Workspace'?input.labelFieldKey:null,input.sourceType==='Workspace'?input.filterFieldKey||null:null,p.userId]).catch((e:any)=>{if(e.code==='23505')throw new ApiError('DUPLICATE_PICKLIST_KEY','Picklist key already exists.',409);throw e});
   if(input.sourceType==='AdminDefined')await replaceValues(tx,p,id,input.values);await audit(tx,p,req,'PICKLIST_CREATED',id);return definition(tx,p,id);
  });return reply.code(201).send({data:result});
 });
 app.patch('/api/v1/picklists/:id',{preHandler:auth(true)},async req=>{
  const p=principal(req);requirePermission(p,'workspaces:configure');const id=String((req.params as any).id),input=parse(update,req.body);
  return{data:await db.transaction(async tx=>{
   const old=await definition(tx,p,id);
   if(old.version!==input.version)throw new ApiError('RECORD_VERSION_CONFLICT','Picklist changed. Refresh before saving.',409);
   if(old.sourceType==='Workspace'&&input.values)throw new ApiError('WORKSPACE_VALUES_READ_ONLY','Workspace values are maintained in their source workspace.',422);
   if(old.sourceType!=='Workspace'&&input.values)await replaceValues(tx,p,id,input.values,true);
   // Claim version before editing child rows; a concurrent writer rolls back the entire transaction.
   const changed=await tx.query('UPDATE picklist_definitions SET name=$1,description=$2,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND school_id=$4 AND version=$5 AND active=true RETURNING id',[input.name,input.description,id,p.schoolId,input.version]);
   if(!changed.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','Picklist changed. Refresh before saving.',409);
   if(old.sourceType==='Workspace'&&input.values)throw new ApiError('WORKSPACE_VALUES_READ_ONLY','Workspace values are maintained in their source workspace.',422);
   if(old.sourceType!=='Workspace'&&input.values)await replaceValues(tx,p,id,input.values);
   await audit(tx,p,req,'PICKLIST_UPDATED',id);return definition(tx,p,id);
  })};
 });
 app.post('/api/v1/picklists/:id/archive',{preHandler:auth(true)},async req=>{
  const p=principal(req);requirePermission(p,'workspaces:configure');const id=String((req.params as any).id),input=parse(z.object({version:z.number().int().positive()}).strict(),req.body),old=await definition(db,p,id);
  if(old.isSystem||SYSTEM_PICKLISTS[old.picklistKey])throw new ApiError('SYSTEM_PICKLIST_PROTECTED','System Picklists cannot be archived.',409);
  const used=await db.query<any>("SELECT id FROM workspace_fields WHERE school_id=$1 AND archived=false AND configuration->>'picklistId'=$2 LIMIT 1",[p.schoolId,id]);if(used.rows[0])throw new ApiError('PICKLIST_IN_USE','This Picklist is used by Workspace fields. Deactivate optional values instead.',409);
  await db.transaction(async tx=>{const changed=await tx.query('UPDATE picklist_definitions SET active=false,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND school_id=$2 AND version=$3 AND active=true RETURNING id',[id,p.schoolId,input.version]);if(!changed.rows.length)throw new ApiError('RECORD_VERSION_CONFLICT','Picklist changed. Refresh before archiving.',409);await audit(tx,p,req,'PICKLIST_ARCHIVED',id)});return{data:{archived:true}};
 });
}

