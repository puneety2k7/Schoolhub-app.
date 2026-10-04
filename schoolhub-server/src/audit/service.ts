import { randomUUID } from 'node:crypto';
import type { Queryable } from '../database/types.js';
export type AuditInput={schoolId?:string|null;actorUserId?:string|null;action:string;entityType?:string;entityId?:string;outcome:'SUCCESS'|'FAILED'|'DENIED';reasonCode?:string;correlationId:string;summary?:Record<string,unknown>};
const forbidden=/password|hash|cookie|session|token/i;
function safe(value:Record<string,unknown>={}){return Object.fromEntries(Object.entries(value).filter(([k])=>!forbidden.test(k)).map(([k,v])=>[k,typeof v==='string'&&v.length>200?v.slice(0,200):v]));}
export async function writeAudit(db:Queryable,input:AuditInput){await db.query('INSERT INTO audit_events(id,school_id,actor_user_id,action,entity_type,entity_id,outcome,reason_code,correlation_id,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),input.schoolId||null,input.actorUserId||null,input.action,input.entityType||null,input.entityId||null,input.outcome,input.reasonCode||null,input.correlationId,JSON.stringify(safe(input.summary))]);}
