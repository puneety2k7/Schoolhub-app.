import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {authenticate} from '../auth/security.js';
import {requirePermission} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {workflowSettings,advanceOperation} from '../services/operations-workflows.js';
const creation=z.object({workflowId:z.string().min(1).max(120),subjectType:z.enum(['general','demo']),title:z.string().max(200).default(''),note:z.string().max(10000).default(''),contextData:z.object({leaveDuration:z.number().finite().optional(),feeAmount:z.number().finite().optional(),certificateType:z.string().max(100).optional()}).strict().default({})}).strict();
function parse<T>(schema:z.ZodType<T>,body:unknown):T{const r=schema.safeParse(body);if(!r.success)throw new ApiError('VALIDATION_FAILED','Check the task fields.',422);return r.data;}
export async function registerWorkflowTaskRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=async(req:FastifyRequest)=>authenticate(req,db,config,true);
 app.post('/api/v1/workflow-tasks',{preHandler:auth},async(req,reply)=>{
  const p=req.principal!;requirePermission(p,'workflows:manage');const input=parse(creation,req.body);
  const data=await db.transaction(async tx=>{
   const settings=await workflowSettings(tx,p.schoolId,true),wf=settings.definitions.find((w:any)=>w.id===input.workflowId&&w.enabled&&!w.archived);
   if(!wf)throw new ApiError('WORKFLOW_UNAVAILABLE','Select an enabled workflow.',422);
   const steps=wf.steps.filter((s:any)=>!s.disabled).sort((a:any,b:any)=>a.order-b.order);
   if(!steps.length)throw new ApiError('WORKFLOW_UNAVAILABLE','Workflow has no active steps.',422);
   if(input.subjectType!=='demo'&&steps.some((s:any)=>s.systemActionId))throw new ApiError('VALIDATION_FAILED','Start operational requests from their module so the final action has a valid record.',422);
   const id=randomUUID(),now=new Date().toISOString(),data={id,workflowId:wf.id,workflowVersion:wf.version,stepsSnapshot:steps,subjectType:input.subjectType,subjectId:id,title:input.title.trim()||wf.name,contextData:input.contextData,currentStepId:steps[0].id,status:'In Progress',createdDate:now.slice(0,10),createdBy:p.username,completedDate:null,history:[{stepId:steps[0].id,stepNameSnapshot:steps[0].name,actor:p.username,actorRole:p.roleName,action:'Created',timestamp:now,note:input.note}]};
   await tx.query('INSERT INTO operation_workflow_instances(id,school_id,workflow_id,subject_type,subject_id,data) VALUES($1,$2,$3,$4,$5,$6)',[id,p.schoolId,wf.id,input.subjectType,id,JSON.stringify(data)]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'WORKFLOW_TASK_CREATED',entityType:'Workflow',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});return {...data,version:1};
  });return reply.code(201).send({data});
 });
 app.post('/api/v1/workflow-tasks/:id/decision',{preHandler:auth},async req=>{
  const p=req.principal!;requirePermission(p,'workflows:manage');const id=String((req.params as any).id),input=parse(z.object({version:z.number().int().positive(),decision:z.enum(['Approved','Rejected']),note:z.string().max(10000)}).strict(),req.body);
  return {data:await db.transaction(async tx=>{
   const row=(await tx.query<any>('SELECT data,version FROM operation_workflow_instances WHERE school_id=$1 AND id=$2 FOR UPDATE',[p.schoolId,id])).rows[0];
   if(!row)throw new ApiError('NOT_FOUND','Task not found.',404);
   if(!['general','demo'].includes(row.data.subjectType))throw new ApiError('VALIDATION_FAILED','Decide operational requests through their module.',422);
   if(row.version!==input.version)throw new ApiError('RECORD_VERSION_CONFLICT','Task changed. Refresh before deciding.',409);
   const result=await advanceOperation(tx,p,row.data.subjectType,row.data.subjectId,input.decision,input.note);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'WORKFLOW_TASK_DECIDED',entityType:'Workflow',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});return result.instance;
  })};
 });
}
