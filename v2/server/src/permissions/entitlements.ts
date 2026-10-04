import {
  NORMAL_PERMISSIONS, requiredSelections, type OperationalTabKey, type StandardOperation, type PermissionSelection, selectionKey,
} from '../../../shared/src/index.js';
import type { Db } from '../db/database.js';
import type { Principal } from '../auth/auth-service.js';

/**
 * What one user may do inside one workspace.
 *
 *   System Administrator → every check succeeds, from backend authority (no stored rows involved).
 *   Everyone else        → User → Group(s) → Role(s) → this workspace's role selections.
 *
 * WORKSPACE_ADMINISTRATOR widens only the NORMAL tab permissions and record scope. It never grants the lifecycle
 * specials (VIEW_ARCHIVED_RECORDS, RESTORE_ARCHIVED_RECORDS, PERMANENT_DELETE): those must be selected explicitly.
 */
export class Entitlements {
  constructor(readonly systemAdministrator: boolean, private readonly selections: ReadonlySet<string>) {}

  private get workspaceAdministrator() { return this.selections.has('SPECIAL|WORKSPACE_ADMINISTRATOR'); }

  /** Dashboard VIEW. Independent of every tab permission. */
  canViewDashboard(): boolean { return this.systemAdministrator || this.selections.has('DASHBOARD|VIEW'); }

  tab(tab: OperationalTabKey, permission: (typeof NORMAL_PERMISSIONS)[number]): boolean {
    return this.systemAdministrator || this.selections.has(selectionKey(tab, permission)) || this.workspaceAdministrator;
  }
  special(permission: string): boolean { return this.systemAdministrator || this.selections.has(`SPECIAL|${permission}`); }

  /** Records owned by other users are visible only with this scope (or as Workspace Administrator). */
  seesRecordsOwnedByOthers(): boolean { return this.systemAdministrator || this.workspaceAdministrator || this.selections.has('SPECIAL|VIEW_RECORDS_OWNED_BY_OTHERS'); }
  seesArchived(): boolean { return this.special('VIEW_ARCHIVED_RECORDS'); }

  private holds(requirement: string): boolean {
    const [tabKey, permission] = requirement.split('|') as [string, string];
    return tabKey === 'SPECIAL' ? this.special(permission) : this.tab(tabKey as OperationalTabKey, permission as (typeof NORMAL_PERMISSIONS)[number]);
  }
  /** Does the user hold every permission the standard operation requires on this tab? (Record scope is checked separately.) */
  allows(operation: StandardOperation, tab: OperationalTabKey): boolean {
    return requiredSelections(operation, tab).every((requirement) => this.holds(requirement));
  }
  anyTab(): boolean { return (['MAIN', 'GRID_1', 'GRID_2', 'GRID_3'] as const).some((tab) => this.tab(tab, 'VIEW')); }
}

const ALL = new Entitlements(true, new Set());

/** Effective selections per workspace for a user, in one query. Not consulted at all for a System Administrator. */
export async function loadEntitlementsByWorkspace(db: Db, principal: Principal): Promise<Map<string, Entitlements>> {
  const out = new Map<string, Entitlements>();
  if (principal.systemAdministrator) return out;
  const rows = (await db.query<{ workspace_id: string; tab_key: string; permission_key: string }>(
    `SELECT DISTINCT r.workspace_id, rp.tab_key, rp.permission_key
       FROM group_members gm
       JOIN group_roles gr ON gr.group_id = gm.group_id
       JOIN roles r ON r.id = gr.role_id AND r.school_id = $2
       JOIN role_permissions rp ON rp.role_id = r.id
      WHERE gm.user_id = $1`, [principal.userId, principal.schoolId])).rows;
  const byWorkspace = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = byWorkspace.get(row.workspace_id) ?? new Set<string>();
    set.add(`${row.tab_key}|${row.permission_key}`);
    byWorkspace.set(row.workspace_id, set);
  }
  for (const [workspaceId, selections] of byWorkspace) out.set(workspaceId, new Entitlements(false, selections));
  return out;
}

export async function loadEntitlements(db: Db, principal: Principal, workspaceId: string): Promise<Entitlements> {
  if (principal.systemAdministrator) return ALL;
  return (await loadEntitlementsByWorkspace(db, principal)).get(workspaceId) ?? new Entitlements(false, new Set());
}

export function toSelections(set: ReadonlySet<string>): PermissionSelection[] {
  return [...set].map((value) => { const [tabKey, permissionKey] = value.split('|') as [PermissionSelection['tabKey'], string]; return { tabKey, permissionKey }; });
}
