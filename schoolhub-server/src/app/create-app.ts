import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/index.js';
import type { Database } from '../database/types.js';
import { ApiError } from '../errors/api-error.js';
import { writeAudit } from '../audit/service.js';
import { registerApi } from '../routes/api.js';
import { prepareLogFile } from '../logging/service.js';

export async function createApp(config:AppConfig,db:Database){
 const logFile=prepareLogFile(config),logger=config.logLevel==='silent'?false:{level:config.logLevel,redact:{paths:['req.headers.cookie','req.headers.authorization','req.headers.x-csrf-token','req.body.password','req.body.currentPassword','req.body.newPassword','password','token','secret','csrf','session','databaseUrl'],censor:'[REDACTED]'},...(logFile?{file:logFile}:{})};
 const app=Fastify({logger,trustProxy:config.trustProxy,bodyLimit:25*1024*1024,requestIdHeader:'x-request-id',genReqId:req=>String(req.headers['x-request-id']||randomUUID())});
 await app.register(cookie);
 await app.register(cors,{credentials:true,methods:['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],origin(origin,cb){if(!origin||config.allowedOrigins.includes(origin))cb(null,true);else cb(new ApiError('CORS_ORIGIN_DENIED','This origin is not allowed.',403),false);}});
 app.addHook('onRequest',async(req,reply)=>{req.correlationId=String(req.id||randomUUID());reply.header('x-request-id',req.correlationId).header('x-content-type-options','nosniff').header('x-frame-options','DENY').header('referrer-policy','no-referrer').header('cache-control','no-store').header('content-security-policy',"default-src 'none'; frame-ancestors 'none'");if(['POST','PATCH','PUT','DELETE'].includes(req.method)){const origin=req.headers.origin;if(origin&&!config.allowedOrigins.includes(origin))throw new ApiError('CORS_ORIGIN_DENIED','This origin is not allowed.',403);}});
 app.setErrorHandler(async(error:any,req,reply)=>{let e=error instanceof ApiError?error:new ApiError(error.code==='FST_ERR_CTP_BODY_TOO_LARGE'?'REQUEST_TOO_LARGE':error.code==='FST_ERR_CTP_INVALID_JSON_BODY'?'INVALID_JSON':'INTERNAL_ERROR',error.code==='FST_ERR_CTP_BODY_TOO_LARGE'?'The request is too large.':error.code==='FST_ERR_CTP_INVALID_JSON_BODY'?'The request contains invalid JSON.':'The server could not complete the request.',error.statusCode&&error.statusCode<500?error.statusCode:error.code==='FST_ERR_CTP_BODY_TOO_LARGE'?413:error.code==='FST_ERR_CTP_INVALID_JSON_BODY'?400:500);if(e.status>=500)req.log.error({err:error,correlationId:req.correlationId},'Request failed');if(req.principal&&String(req.routeOptions.url||'').includes('workspace')){const protectedCodes=['SYSTEM_FIELD_PROPERTY_PROTECTED','IMMUTABLE_FIELD_KEY','IMMUTABLE_SECTION_KEY','IMMUTABLE_WORKSPACE_KEY','SYSTEM_WORKSPACE_PROTECTED'],validationCodes=['VALIDATION_FAILED','UNSUPPORTED_FIELD_TYPE','FIELD_OPTIONS_NOT_SUPPORTED','FIELD_OPTIONS_REQUIRED','DUPLICATE_FIELD_OPTION'];const action=e.status===403?'AUTHORIZATION_DENIED':protectedCodes.includes(e.code)?'WORKSPACE_PROTECTED_CHANGE_DENIED':e.code==='RECORD_VERSION_CONFLICT'?'WORKSPACE_VERSION_CONFLICT':validationCodes.includes(e.code)?'WORKSPACE_VALIDATION_FAILED':null;if(action)await writeAudit(db,{schoolId:req.principal.schoolId,actorUserId:req.principal.userId,action,entityType:'Request',outcome:e.status===403||protectedCodes.includes(e.code)?'DENIED':'FAILED',reasonCode:e.code,correlationId:req.correlationId,summary:{method:req.method,path:req.routeOptions.url}}).catch(()=>{})};reply.code(e.status).send({error:{code:e.code,message:e.message,details:e.details||undefined,correlationId:req.correlationId}});});
 await registerApi(app,db,config);return app;
}
