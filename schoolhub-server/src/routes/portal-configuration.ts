import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {AppConfig} from '../config/index.js';
import type {Database} from '../database/types.js';
import {authenticate} from '../auth/security.js';
import {requirePermission,type Principal} from '../authorization/service.js';
import {requireSetupAdministration} from '../authorization/access-control.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {PORTAL_MODULE_KEYS,normalizePortalConfiguration} from '../services/portal-configuration.js';

const moduleShape=Object.fromEntries(PORTAL_MODULE_KEYS.map(key=>[key,z.boolean()])) as Record<(typeof PORTAL_MODULE_KEYS)[number],z.ZodBoolean>;
const update=z.object({enabled:z.boolean(),accessMode:z.enum(['Off','ReadOnly','Pilot']),modules:z.object(moduleShape).strict(),teacher:z.object({attendance:z.boolean(),homework:z.boolean(),marks:z.boolean(),workLogs:z.boolean()}).strict(),pwa:z.object({enabled:z.boolean(),installPrompt:z.boolean(),offlineShell:z.boolean()}).strict(),version:z.number().int().positive()}).strict();
function principal(req:FastifyRequest):Principal{if(!req.principal)throw new ApiError('AUTHENTICATION_REQUIRED','Authentication is required.',401);return req.principal}
function parsed(value:unknown){const result=update.safeParse(value);if(!result.success)throw new ApiError('VALIDATION_FAILED','The portal configuration contains invalid fields.',422,{fields:result.error.issues.map(x=>x.path.join('.'))});return result.data}
const auth=(db:Database,config:AppConfig,write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);

export async function registerPortalConfigurationRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 app.get('/api/v1/portal-configuration',{preHandler:auth(db,config)},async req=>{const p=principal(req);await requireSetupAdministration(db,p);requirePermission(p,'portal:manage');const row=(await db.query<any>('SELECT settings FROM schools WHERE id=$1',[p.schoolId])).rows[0];return{data:{...normalizePortalConfiguration(row?.settings?.portalConfiguration),serverUpperBound:config.portalRolloutMode||'ReadOnly'}}});
 app.patch('/api/v1/portal-configuration',{preHandler:auth(db,config,true)},async req=>{const p=principal(req);await requireSetupAdministration(db,p);requirePermission(p,'portal:manage');const input=parsed(req.body);if(!input.pwa.enabled&&(input.pwa.installPrompt||input.pwa.offlineShell))throw new ApiError('INVALID_PORTAL_CONFIGURATION','Install prompts and offline shell require the PWA switch.',422);if(!input.enabled&&input.accessMode!=='Off')throw new ApiError('INVALID_PORTAL_CONFIGURATION','A disabled portal must use Off access mode.',422);const result=await db.transaction(async tx=>{const school=(await tx.query<any>('SELECT settings FROM schools WHERE id=$1 FOR UPDATE',[p.schoolId])).rows[0];const old=normalizePortalConfiguration(school?.settings?.portalConfiguration);if(old.version!==input.version)throw new ApiError('RECORD_VERSION_CONFLICT','Portal settings changed on another device. Refresh and review before saving.',409);const next={...input,version:old.version+1},settings={...(school?.settings||{}),portalConfiguration:next};await tx.query('UPDATE schools SET settings=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[JSON.stringify(settings),p.schoolId]);await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action:'PORTAL_CONFIGURATION_UPDATED',entityType:'School',entityId:p.schoolId,outcome:'SUCCESS',correlationId:req.correlationId,summary:{enabled:next.enabled,accessMode:next.accessMode,modules:next.modules,teacher:next.teacher,pwa:next.pwa}});return next});return{data:{...result,serverUpperBound:config.portalRolloutMode||'ReadOnly'}}});
}
