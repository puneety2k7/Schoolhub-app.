import {authorizeArchivedLifecycle} from '../authorization/policy-engine.js';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Queryable} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {authenticate} from '../auth/security.js';
import {requirePermission} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {transportRouteSchema as routeSchema,validateTransport} from '../services/transport-workspace.js';
import {WorkspaceService} from '../services/workspace-service.js';
import {readHomeworkPicklist} from '../services/homework-picklists.js';
const versionSchema=z.object({version:z.number().int().positive()}).strict();
function parse<T>(s:z.ZodType<T>,v:unknown):T{const r=s.safeParse(v);if(!r.success)throw new ApiError('VALIDATION_FAILED','Check the route or assignment fields.',422);return r.data;}
const conflict=()=>new ApiError('RECORD_VERSION_CONFLICT','This route or assignment changed. Refresh before saving.',409);
async function lockRoute(tx:Queryable,school:string,id:string){const row=(await tx.query<any>('SELECT id,data,version FROM transport_routes WHERE school_id=$1 AND id=$2 AND archived=false FOR UPDATE',[school,id])).rows[0];if(!row)throw new ApiError('NOT_FOUND','Route not found.',404);return row;}
export async function registerTransportRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 const audit=async(tx:Queryable,req:FastifyRequest,action:string,id:string)=>writeAudit(tx,{schoolId:req.principal!.schoolId,actorUserId:req.principal!.userId,action,entityType:'Transport',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});
 app.get('/api/v1/transport',{preHandler:auth()},async req=>{
  const p=req.principal!;requirePermission(p,'transport:view');
  const ws=new WorkspaceService(db);await ws.syncFactories(p,'transport-workspace');
  const wid=(await db.query<any>("SELECT id FROM workspace_definitions WHERE school_id=$1 AND workspace_key='transport'",[p.schoolId])).rows[0].id;
  const routes=(await db.query<any>('SELECT id,data,version,archived FROM transport_routes WHERE school_id=$1 ORDER BY created_at,id',[p.schoolId])).rows;
  const staff=(await db.query<any>('SELECT id,name,status,role_name AS role FROM staff WHERE school_id=$1 ORDER BY name',[p.schoolId])).rows.map(x=>({...x,active:x.status==='Active'}));
  for(const r of routes)for(const [key,name]of [['driverId','driver'],['attendantId','attendant']])if(r.data[key])r.data[name]=staff.find(x=>x.id===r.data[key])?.name||'Unavailable staff';
  const assignments=(await db.query('SELECT student_id AS "studentId",route_id AS "busId",pickup_stop AS "pickupStop",drop_stop AS "dropStop",version FROM transport_assignments WHERE school_id=$1',[p.schoolId])).rows;
  const students=(await db.query('SELECT s.id,s.name,s.admission_number AS admission,s.status,c.name AS class,se.name AS section FROM students s JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id LEFT JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id WHERE s.school_id=$1 ORDER BY s.name',[p.schoolId])).rows;
  return {data:{routes:routes.filter(x=>!x.archived),archivedRoutes:routes.filter(x=>x.archived),assignments,students,staff,classes:(await db.query('SELECT id,name,active FROM classes WHERE school_id=$1',[p.schoolId])).rows,sections:(await db.query('SELECT id,name,class_id AS "classId",active FROM sections WHERE school_id=$1',[p.schoolId])).rows,statuses:await readHomeworkPicklist(db,p.schoolId,'transportStatus'),shifts:await readHomeworkPicklist(db,p.schoolId,'transportShift'),vehicles:await readHomeworkPicklist(db,p.schoolId,'transportVehicle'),definition:await ws.definition(db,p,wid)}};
 });
 app.post('/api/v1/transport/routes',{preHandler:auth(true)},async(req,reply)=>{
  const p=req.principal!;requirePermission(p,'transport:create');const input=parse(routeSchema,req.body),id=randomUUID();
  const row=await db.transaction(async tx=>{const data=await validateTransport(tx,p.schoolId,input);const r=await tx.query('INSERT INTO transport_routes(id,school_id,data) VALUES($1,$2,$3) RETURNING id,data,version',[id,p.schoolId,JSON.stringify(data)]);await audit(tx,req,'TRANSPORT_CREATED',id);return r.rows[0];});return reply.code(201).send({data:row});
 });
 app.patch('/api/v1/transport/routes/:id',{preHandler:auth(true)},async req=>{
  const p=req.principal!,id=String((req.params as any).id);requirePermission(p,'transport:update');const input=parse(z.object({data:routeSchema,version:z.number().int().positive()}).strict(),req.body);
  const row=await db.transaction(async tx=>{
   const old=await lockRoute(tx,p.schoolId,id);if(old.version!==input.version)throw conflict();
   const data=await validateTransport(tx,p.schoolId,input.data,old.data,id);
   const stops=data.stops.split(',').map((s:string)=>s.trim()).filter(Boolean);
   const assignments=(await tx.query<any>('SELECT pickup_stop,drop_stop FROM transport_assignments WHERE school_id=$1 AND route_id=$2',[p.schoolId,id])).rows;
   if(assignments.some(a=>(a.pickup_stop&&!stops.includes(a.pickup_stop))||(a.drop_stop&&!stops.includes(a.drop_stop))))throw new ApiError('VALIDATION_FAILED','Reassign students before removing a stop they use.',422);
   const r=await tx.query('UPDATE transport_routes SET data=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$2 AND id=$3 RETURNING id,data,version',[JSON.stringify(data),p.schoolId,id]);await audit(tx,req,'TRANSPORT_UPDATED',id);return r.rows[0];
  });return {data:row};
 });
 app.post('/api/v1/transport/routes/:id/remove',{preHandler:auth(true)},async req=>{
  const p=req.principal!,id=String((req.params as any).id);requirePermission(p,'transport:delete');const input=parse(versionSchema,req.body);
  await db.transaction(async tx=>{const old=await lockRoute(tx,p.schoolId,id);if(old.version!==input.version)throw conflict();await tx.query('UPDATE transport_routes SET archived=true,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$1 AND id=$2',[p.schoolId,id]);await audit(tx,req,'TRANSPORT_REMOVED',id);});return {data:{removed:true}};
 });
 app.post('/api/v1/transport/routes/:id/restore',{preHandler:auth(true)},async req=>{
  const p=req.principal!,id=String((req.params as any).id);
  const input=parse(versionSchema,req.body);
  await db.transaction(async tx=>{const old=await lockRoute(tx,p.schoolId,id);await authorizeArchivedLifecycle(tx,p,'record.restore',{schoolId:p.schoolId,workspaceKey:'transport',resourceType:'transport-route',recordId:id,lifecycle:old.archived?'Archived':'Active'});const r=await tx.query("UPDATE transport_routes SET archived=false,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$1 AND id=$2 AND archived=true AND version=$3 RETURNING id",[p.schoolId,id,input.version]);if(!r.rows.length)throw conflict();await audit(tx,req,'TRANSPORT_RESTORED',id)});return{data:{restored:true}};
 });
 app.put('/api/v1/transport/assignments/:studentId',{preHandler:auth(true)},async req=>{
  const p=req.principal!,studentId=String((req.params as any).studentId);requirePermission(p,'transport:update');
  const input=parse(z.object({busId:z.string().min(1).nullable(),pickupStop:z.string().max(240),dropStop:z.string().max(240),version:z.number().int().nonnegative()}).strict(),req.body);
  const row=await db.transaction(async tx=>{
   if(input.busId){const bus=await lockRoute(tx,p.schoolId,input.busId),stops=bus.data.stops.split(',').map((s:string)=>s.trim()).filter(Boolean);if((input.pickupStop&&!stops.includes(input.pickupStop))||(input.dropStop&&!stops.includes(input.dropStop)))throw new ApiError('VALIDATION_FAILED','Select a stop belonging to this route.',422);}
   const student=(await tx.query<any>('SELECT id,class_id,section_id,status FROM students WHERE school_id=$1 AND id=$2 FOR UPDATE',[p.schoolId,studentId])).rows[0];if(!student)throw new ApiError('NOT_FOUND','Student not found.',404);
   if(input.busId){const bus=await lockRoute(tx,p.schoolId,input.busId);if(bus.data.status!=='Active'||student.status!=='Active')throw new ApiError('VALIDATION_FAILED','Only active students and routes can be assigned.',422);
    if(bus.data.classIds?.length&&!bus.data.classIds.includes(student.class_id))throw new ApiError('VALIDATION_FAILED','Student class is not served by this route.',422);
    if(bus.data.sectionIds?.length&&!bus.data.sectionIds.includes(student.section_id))throw new ApiError('VALIDATION_FAILED','Student section is not served by this route.',422);
    const count=Number((await tx.query<any>('SELECT count(*) AS n FROM transport_assignments WHERE school_id=$1 AND route_id=$2 AND student_id<>$3',[p.schoolId,input.busId,studentId])).rows[0].n);if(bus.data.capacity&&count>=bus.data.capacity)throw new ApiError('VALIDATION_FAILED','Route capacity is full.',422);
   }
   const old=(await tx.query<any>('SELECT version FROM transport_assignments WHERE school_id=$1 AND student_id=$2',[p.schoolId,studentId])).rows[0];if((old?.version||0)!==input.version)throw conflict();
   const r=old?await tx.query('UPDATE transport_assignments SET route_id=$1,pickup_stop=$2,drop_stop=$3,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$4 AND student_id=$5 RETURNING version',[input.busId,input.busId?input.pickupStop:'',input.busId?input.dropStop:'',p.schoolId,studentId]):await tx.query('INSERT INTO transport_assignments(school_id,student_id,route_id,pickup_stop,drop_stop) VALUES($1,$2,$3,$4,$5) RETURNING version',[p.schoolId,studentId,input.busId,input.busId?input.pickupStop:'',input.busId?input.dropStop:'']);await audit(tx,req,input.busId?'TRANSPORT_ASSIGNED':'TRANSPORT_UNASSIGNED',studentId);return r.rows[0];
  });return {data:row};
 });
}

