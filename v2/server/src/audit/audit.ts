import type { Db } from '../db/database.js';

export type AuditEvent = {
  schoolId: string; actorUserId: string | null; action: string; entityType: string; entityId: string;
  workspaceId?: string | null; tabKey?: string | null; outcome?: 'SUCCESS' | 'DENIED'; summary?: Record<string, unknown>;
};
/** Audit events are written in the same transaction as the change they describe. */
export async function writeAudit(db: Db, event: AuditEvent): Promise<void> {
  await db.query(
    'INSERT INTO audit_events(school_id,actor_user_id,action,entity_type,entity_id,workspace_id,tab_key,outcome,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [event.schoolId, event.actorUserId, event.action, event.entityType, event.entityId, event.workspaceId ?? null, event.tabKey ?? null, event.outcome ?? 'SUCCESS', JSON.stringify(event.summary ?? {})],
  );
}
