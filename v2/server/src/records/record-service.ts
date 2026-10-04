import {
  OPERATION_STATES, type OperationalTabKey, type StandardOperation, type RecordState,
} from '../../../shared/src/index.js';
import type { Database, Db } from '../db/database.js';
import type { Principal } from '../auth/auth-service.js';
import { loadEntitlements, type Entitlements } from '../permissions/entitlements.js';
import { loadDefinition, recordLabel, tabFields, type FieldDefinition, type WorkspaceDefinition } from '../workspaces/definition.js';
import { validateValues } from './validation.js';
import { writeAudit } from '../audit/audit.js';
import { AppError, conflict, forbidden, notFound } from '../http/errors.js';

export type RecordDto = {
  id: string; tabKey: OperationalTabKey; state: RecordState; version: number; values: Record<string, unknown>;
  ownerUserId: string; createdAt: string; updatedAt: string; archivedAt: string | null;
};
type Row = { id: string; tab_key: OperationalTabKey; state: RecordState; version: number; field_values: Record<string, unknown>; owner_user_id: string; created_at: Date; updated_at: Date; archived_at: Date | null };
const COLUMNS = 'id,tab_key,state,version,field_values,owner_user_id,created_at,updated_at,archived_at';
const toDto = (row: Row): RecordDto => ({
  id: row.id, tabKey: row.tab_key, state: row.state, version: row.version, values: row.field_values, ownerUserId: row.owner_user_id,
  createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), archivedAt: row.archived_at ? row.archived_at.toISOString() : null,
});

type Context = { definition: WorkspaceDefinition; ent: Entitlements };

/**
 * The universal record engine. One service authorizes, enforces the lifecycle and audits every standard operation on every
 * tab of every workspace. There is no per-workspace code here and no way for a Grid operation to act on another tab.
 */
export class RecordService {
  constructor(private readonly db: Database) {}

  private async context(db: Db, p: Principal, workspaceKey: string): Promise<Context> {
    const definition = await loadDefinition(db, p.schoolId, { key: workspaceKey });
    if (!definition || definition.status !== 'Active') throw notFound('Workspace');
    return { definition, ent: await loadEntitlements(db, p, definition.id) };
  }
  /** Tab-level authorization for a standard operation. Dashboard VIEW is never consulted here. */
  private require(ent: Entitlements, operation: StandardOperation, tab: OperationalTabKey) {
    if (!ent.allows(operation, tab)) throw forbidden('Access is denied.', { operation, tab });
  }
  private sees(ent: Entitlements, p: Principal, row: Pick<Row, 'owner_user_id' | 'state'>) {
    if (row.state === 'Archived' && !ent.seesArchived()) return false;
    return ent.seesRecordsOwnedByOthers() || row.owner_user_id === p.userId;
  }
  private audit(tx: Db, p: Principal, definition: WorkspaceDefinition, tab: OperationalTabKey, action: string, id: string, summary: Record<string, unknown> = {}) {
    return writeAudit(tx, { schoolId: p.schoolId, actorUserId: p.userId, action, entityType: 'Record', entityId: id, workspaceId: definition.id, tabKey: tab, summary });
  }
  /** Reference targets must be records the user may see (so a reference cannot be forged by guessing an id). */
  private referenceGuard(tx: Db, p: Principal) {
    return async (field: FieldDefinition, targetId: string) => {
      const ent = await loadEntitlements(tx, p, field.referenceWorkspaceId!);
      const target = (await tx.query<Row>(`SELECT ${COLUMNS} FROM records WHERE id=$1`, [targetId])).rows[0];
      if (!target || !ent.tab('MAIN', 'VIEW') || !this.sees(ent, p, target)) throw new AppError(422, 'FIELD_INVALID', `${field.label}: you cannot reference that record.`, { fieldKey: field.key });
    };
  }

  /** VIEW (list): tab VIEW; archived rows additionally need VIEW_ARCHIVED_RECORDS; others' rows need the others-scope. */
  async list(p: Principal, workspaceKey: string, tab: OperationalTabKey) {
    const { definition, ent } = await this.context(this.db, p, workspaceKey);
    this.require(ent, 'view', tab);
    const rows = (await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM records WHERE workspace_id=$1 AND tab_key=$2 AND school_id=$3
         AND state = ANY($4) AND ($5 OR owner_user_id=$6)
       ORDER BY state, created_at DESC LIMIT 500`,
      [definition.id, tab, p.schoolId, ent.seesArchived() ? ['Active', 'Archived'] : ['Active'], ent.seesRecordsOwnedByOthers(), p.userId])).rows;
    return { items: rows.map(toDto), references: await this.referenceLabels(this.db, p, tabFields(definition, tab), rows) };
  }

  /** Human labels for the reference values shown in a list. */
  private async referenceLabels(db: Db, p: Principal, fields: FieldDefinition[], rows: Row[]): Promise<Record<string, string>> {
    const refFields = fields.filter((field) => field.type === 'reference');
    const ids = new Set<string>();
    for (const row of rows) for (const field of refFields) { const value = row.field_values[field.key]; if (typeof value === 'string') ids.add(value); }
    if (!ids.size) return {};
    const targets = (await db.query<{ id: string; workspace_id: string; field_values: Record<string, unknown> }>(
      'SELECT id,workspace_id,field_values FROM records WHERE id = ANY($1) AND school_id=$2', [[...ids], p.schoolId])).rows;
    const definitions = new Map<string, WorkspaceDefinition | null>();
    const out: Record<string, string> = {};
    for (const target of targets) {
      if (!definitions.has(target.workspace_id)) definitions.set(target.workspace_id, await loadDefinition(db, p.schoolId, { id: target.workspace_id }));
      const definition = definitions.get(target.workspace_id);
      if (definition) out[target.id] = recordLabel(definition, target.field_values);
    }
    return out;
  }

  /** Choices for a reference field: Active MAIN records of the target workspace that the user may see. */
  async referenceOptions(p: Principal, workspaceKey: string, fieldKey: string, query: string) {
    const { definition } = await this.context(this.db, p, workspaceKey);
    const field = definition.tabs.flatMap((tab) => tab.sections.flatMap((section) => section.fields)).find((candidate) => candidate.key === fieldKey);
    if (!field || field.type !== 'reference') throw notFound('Reference field');
    const target = await loadDefinition(this.db, p.schoolId, { id: field.referenceWorkspaceId! });
    if (!target) throw notFound('Referenced workspace');
    const ent = await loadEntitlements(this.db, p, target.id);
    if (!ent.tab('MAIN', 'VIEW')) return [];
    const rows = (await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM records WHERE workspace_id=$1 AND tab_key='MAIN' AND state='Active' AND ($2 OR owner_user_id=$3) ORDER BY created_at DESC LIMIT 200`,
      [target.id, ent.seesRecordsOwnedByOthers(), p.userId])).rows;
    const needle = query.trim().toLowerCase();
    return rows.map((row) => ({ id: row.id, label: recordLabel(target, row.field_values) })).filter((option) => !needle || option.label.toLowerCase().includes(needle)).slice(0, 50);
  }

  /** ADD: tab ADD. Creates a record on THIS tab only. */
  async create(p: Principal, workspaceKey: string, tab: OperationalTabKey, input: Record<string, unknown>): Promise<RecordDto> {
    return this.db.tx(async (tx) => {
      const { definition, ent } = await this.context(tx, p, workspaceKey);
      this.require(ent, 'add', tab);
      const { values, references } = await validateValues(tx, definition, tab, input, 'create', {}, this.referenceGuard(tx, p));
      const row = (await tx.query<Row>(
        `INSERT INTO records(school_id,workspace_id,tab_key,field_values,owner_user_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5,$5) RETURNING ${COLUMNS}`,
        [p.schoolId, definition.id, tab, JSON.stringify(values), p.userId])).rows[0]!;
      await this.writeReferences(tx, row.id, references);
      await this.audit(tx, p, definition, tab, 'RECORD_CREATED', row.id);
      return toDto(row);
    });
  }

  private async lock(tx: Db, definition: WorkspaceDefinition, tab: OperationalTabKey, id: string, state: RecordState): Promise<Row> {
    const row = (await tx.query<Row>(`SELECT ${COLUMNS} FROM records WHERE id=$1 AND workspace_id=$2 AND tab_key=$3 AND state=$4 FOR UPDATE`, [id, definition.id, tab, state])).rows[0];
    if (!row) throw notFound(state === 'Active' ? 'Record' : 'Archived record');
    return row;
  }
  private checkVersion(row: Row, version: number) {
    if (row.version !== version) throw conflict('RECORD_VERSION_CONFLICT', 'The record changed. Reload and try again.');
  }
  private async writeReferences(tx: Db, recordId: string, references: { fieldKey: string; targetId: string }[]) {
    await tx.query('DELETE FROM record_references WHERE source_record_id=$1', [recordId]);
    for (const reference of references) await tx.query('INSERT INTO record_references(source_record_id,field_key,target_record_id) VALUES($1,$2,$3)', [recordId, reference.fieldKey, reference.targetId]);
  }

  /** EDIT: tab EDIT, ACTIVE record, within the user's record scope. */
  async update(p: Principal, workspaceKey: string, tab: OperationalTabKey, id: string, version: number, input: Record<string, unknown>): Promise<RecordDto> {
    return this.db.tx(async (tx) => {
      const { definition, ent } = await this.context(tx, p, workspaceKey);
      this.require(ent, 'edit', tab);
      const row = await this.lock(tx, definition, tab, id, 'Active');
      if (!this.sees(ent, p, row)) throw forbidden('Access is denied.', { operation: 'edit', tab });
      this.checkVersion(row, version);
      const { values, references } = await validateValues(tx, definition, tab, input, 'update', row.field_values, this.referenceGuard(tx, p));
      const updated = (await tx.query<Row>(
        `UPDATE records SET field_values=$1, version=version+1, updated_by=$2, updated_at=now() WHERE id=$3 RETURNING ${COLUMNS}`, [JSON.stringify(values), p.userId, id])).rows[0]!;
      await this.writeReferences(tx, id, references);
      await this.audit(tx, p, definition, tab, 'RECORD_UPDATED', id, { fields: Object.keys(input) });
      return toDto(updated);
    });
  }

  private async setState(p: Principal, workspaceKey: string, tab: OperationalTabKey, id: string, version: number, operation: 'archive' | 'restore'): Promise<RecordDto> {
    return this.db.tx(async (tx) => {
      const { definition, ent } = await this.context(tx, p, workspaceKey);
      this.require(ent, operation, tab);
      const from: RecordState = operation === 'archive' ? 'Active' : 'Archived';
      const row = await this.lock(tx, definition, tab, id, from);
      if (!(ent.seesRecordsOwnedByOthers() || row.owner_user_id === p.userId)) throw forbidden('Access is denied.', { operation, tab });
      this.checkVersion(row, version);
      const to: RecordState = operation === 'archive' ? 'Archived' : 'Active';
      const updated = (await tx.query<Row>(
        `UPDATE records SET state=$1, version=version+1, updated_by=$2, updated_at=now(),
                archived_by=CASE WHEN $1='Archived' THEN $2::uuid ELSE NULL END, archived_at=CASE WHEN $1='Archived' THEN now() ELSE NULL END
          WHERE id=$3 RETURNING ${COLUMNS}`, [to, p.userId, id])).rows[0]!;
      await this.audit(tx, p, definition, tab, operation === 'archive' ? 'RECORD_ARCHIVED' : 'RECORD_RESTORED', id);
      return toDto(updated);
    });
  }
  /** ARCHIVE (the only "delete" for normal users): tab DELETE. Soft delete; the same row is kept. */
  archive(p: Principal, workspaceKey: string, tab: OperationalTabKey, id: string, version: number) { return this.setState(p, workspaceKey, tab, id, version, 'archive'); }
  /** RESTORE: tab VIEW + VIEW_ARCHIVED_RECORDS + RESTORE_ARCHIVED_RECORDS. Does not need EDIT. Restores the SAME record. */
  restore(p: Principal, workspaceKey: string, tab: OperationalTabKey, id: string, version: number) { return this.setState(p, workspaceKey, tab, id, version, 'restore'); }

  /** PERMANENT DELETE: tab DELETE + PERMANENT_DELETE, ARCHIVED record, record scope, referential integrity, audit. */
  async permanentDelete(p: Principal, workspaceKey: string, tab: OperationalTabKey, id: string, version: number): Promise<void> {
    await this.db.tx(async (tx) => {
      const { definition, ent } = await this.context(tx, p, workspaceKey);
      this.require(ent, 'permanent_delete', tab);
      const row = await this.lock(tx, definition, tab, id, 'Archived');
      if (!(ent.seesRecordsOwnedByOthers() || row.owner_user_id === p.userId)) throw forbidden('Access is denied.', { operation: 'permanent_delete', tab });
      this.checkVersion(row, version);
      const referencedBy = (await tx.query<{ count: number }>('SELECT count(*)::int AS count FROM record_references WHERE target_record_id=$1', [id])).rows[0]!.count;
      if (referencedBy > 0) throw conflict('RECORD_REFERENCED', `Other records still reference this record (${referencedBy}). Remove those references first.`, { referencedBy });
      await tx.query('DELETE FROM records WHERE id=$1', [id]);
      await this.audit(tx, p, definition, tab, 'RECORD_PERMANENTLY_DELETED', id);
    });
  }
}

// Re-exported so callers can verify the lifecycle table in one place.
export { OPERATION_STATES };
