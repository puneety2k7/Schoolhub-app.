import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {AppConfig} from '../config/index.js';
import type {Database} from '../database/types.js';
import {authenticate} from '../auth/security.js';
import type {Principal} from '../authorization/service.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {experimentalFeatures,mayManageExperimentalFeatures,normalizeExperimentalFeatures} from '../services/experimental-features.js';

const update=z.object({gridTabs:z.boolean(),version:z.number().int().positive()}).strict();
function principal(req:FastifyRequest):Principal{if(!req.principal)throw new ApiError('AUTHENTICATION_REQUIRED','Authentication is required.',401);return req.principal}
function parse(value:unknown){const result=update.safeParse(value);if(!result.success)throw new ApiError('VALIDATION_FAILED','The experimental feature configuration contains invalid fields.',422,{fields:result.error.issues.map(issue=>issue.path.join('.'))});return result.data}
const auth=(db:Database,config:AppConfig,write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);

export async function registerExperimentalFeatureRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 app.get('/api/v1/experimental-features',{preHandler:auth(db,config)},async req=>{const p=principal(req);return{data:{...await experimentalFeatures(db,p.schoolId),canManage:mayManageExperimentalFeatures(p)}}});
 app.patch('/api/v1/experimental-features',{preHandler:auth(db,config,true)},async req=>{
  const p=principal(req);if(!mayManageExperimentalFeatures(p)){await writeAudit(db,{schoolId:p.schoolId,actorUserId:p.userId,action:'EXPERIMENTAL_FEATURES_UPDATED',entityType:'School',entityId:p.schoolId,outcome:'DENIED',reasonCode:'SYSTEM_ADMINISTRATOR_REQUIRED',correlationId:req.correlationId});throw new ApiError('SYSTEM_ADMINISTRATOR_REQUIRED','Only the System Administrator can change experimental features.',403)}
  const input=parse(req.body),result=await db.transaction(async tx=>{
   const school=(await tx.query<any>('SELECT settings FROM schools WHERE id=$1 FOR UPDATE',[p.schoolId])).rows[0];
   if(!school)throw new ApiError('SCHOOL_NOT_FOUND','School not found.',404);
   const previous=normalizeExperimentalFeatures(school.settings?.experimentalFeatures);
   if(previous.version!==input.version)throw new ApiError('RECORD_VERSION_CONFLICT','Experimental feature settings changed on another device. Reload and review before saving.',409);
   const next={gridTabs:input.gridTabs,version:previous.version+1},settings={...(school.settings||{}),experimentalFeatures:next};
   await tx.query('UPDATE schools SET settings=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[JSON.stringify(settings),p.schoolId]);
   await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'EXPERIMENTAL_FEATURES_UPDATED',entityType:'School',entityId:p.schoolId,outcome:'SUCCESS',correlationId:req.correlationId,summary:{gridTabs:{before:previous.gridTabs,after:next.gridTabs}}});
   return next;
  });
  return{data:{...result,canManage:true}};
 });
}
