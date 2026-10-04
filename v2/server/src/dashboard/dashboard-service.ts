import type { Database } from '../db/database.js';
import type { Principal } from '../auth/auth-service.js';
import { loadEntitlements } from '../permissions/entitlements.js';
import { loadDefinition, tabFields } from '../workspaces/definition.js';
import { forbidden, notFound } from '../http/errors.js';

/** Dashboard engine: Metric and Table. Dashboard VIEW opens the dashboard; every number still obeys the SOURCE tab's permissions. */
export class DashboardService {
  constructor(private readonly db: Database) {}
  async get(p: Principal, workspaceKey: string) {
    const definition = await loadDefinition(this.db, p.schoolId, { key: workspaceKey });
    if (!definition || definition.status !== 'Active') throw notFound('Workspace');
    const ent = await loadEntitlements(this.db, p, definition.id);
    if (!ent.canViewDashboard()) throw forbidden('Dashboard VIEW is required.', { tab: 'DASHBOARD' });
    const out = [];
    for (const component of definition.components) {
      const tab = component.config.sourceTab!, base = { id: component.id, type: component.type, title: component.title };
      if (!tab || !ent.tab(tab, 'VIEW')) { out.push({ ...base, status: 'forbidden' as const }); continue; }
      const scope = 'workspace_id=$1 AND tab_key=$2 AND school_id=$3 AND state=\'Active\' AND ($4 OR owner_user_id=$5)';
      const params = [definition.id, tab, p.schoolId, ent.seesRecordsOwnedByOthers(), p.userId];
      if (component.type === 'metric') {
        const aggregation = component.config.aggregation ?? 'count', key = component.config.fieldKey;
        const expression = aggregation === 'count' ? 'count(*)' : `${aggregation}((field_values->>$6)::numeric)`;
        const row = (await this.db.query<{ value: string | null }>(`SELECT ${expression}::text AS value FROM records WHERE ${scope}`, aggregation === 'count' ? params : [...params, key])).rows[0]!;
        out.push({ ...base, status: 'ok' as const, value: row.value === null ? null : Number(row.value) });
      } else {
        const keys = component.config.fieldKeys ?? [], limit = Math.min(component.config.limit ?? 10, 50);
        const columns = tabFields(definition, tab).filter((field) => keys.includes(field.key)).map((field) => ({ key: field.key, label: field.label }));
        const rows = (await this.db.query<{ id: string; field_values: Record<string, unknown> }>(`SELECT id,field_values FROM records WHERE ${scope} ORDER BY created_at DESC LIMIT ${limit}`, params)).rows;
        out.push({ ...base, status: 'ok' as const, columns, rows: rows.map((row) => ({ id: row.id, values: row.field_values })) });
      }
    }
    return out;
  }
}
