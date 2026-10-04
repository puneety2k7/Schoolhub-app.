import { OPERATIONAL_TAB_KEYS, OPERATION_LABELS, STANDARD_OPERATIONS, SPECIAL_PERMISSIONS } from '../../../shared/src/index.js';
import type { Database } from '../db/database.js';
import type { Principal } from '../auth/auth-service.js';
import { loadEntitlements, loadEntitlementsByWorkspace, Entitlements } from '../permissions/entitlements.js';
import { loadDefinition } from './definition.js';
import { notFound } from '../http/errors.js';

/** Workspaces the user can open: System Administrator, or any Dashboard VIEW / tab VIEW. */
export async function navigation(db: Database, p: Principal) {
  const workspaces = (await db.query<any>(`SELECT id,key,name,plural_name AS "pluralName",category,icon FROM workspaces WHERE school_id=$1 AND status='Active' ORDER BY category,name`, [p.schoolId])).rows;
  if (p.systemAdministrator) return workspaces;
  const entitlements = await loadEntitlementsByWorkspace(db, p);
  return workspaces.filter((workspace) => { const ent = entitlements.get(workspace.id); return !!ent && (ent.canViewDashboard() || ent.anyTab()); });
}

/** One document with everything the Universal Runtime renders, already filtered by the caller's permissions. */
export async function runtimeDefinition(db: Database, p: Principal, workspaceKey: string) {
  const definition = await loadDefinition(db, p.schoolId, { key: workspaceKey });
  if (!definition || definition.status !== 'Active') throw notFound('Workspace');
  const ent: Entitlements = await loadEntitlements(db, p, definition.id);
  const tabs = definition.tabs.map((tab) => {
    const visible = ent.tab(tab.key, 'VIEW');
    const form = tab.formId ? definition.forms.find((candidate) => candidate.id === tab.formId) ?? null : null;
    return {
      key: tab.key, label: tab.label, visible,
      permissions: { view: ent.tab(tab.key, 'VIEW'), add: ent.tab(tab.key, 'ADD'), edit: ent.tab(tab.key, 'EDIT'), delete: ent.tab(tab.key, 'DELETE'), print: ent.tab(tab.key, 'PRINT') },
      sections: visible ? tab.sections.map((section) => ({ ...section, fields: section.fields.filter((field) => field.visible) })) : [],
      form: visible ? form : null,
      // Only enabled standard actions the user's permissions allow; the lifecycle decides which apply to a given record.
      actions: !visible ? [] : definition.actions
        .filter((action) => action.tabKey === tab.key && action.enabled && ent.allows(action.operation, tab.key))
        .sort((a, b) => a.sortOrder - b.sortOrder).map((action) => ({ operation: action.operation, label: OPERATION_LABELS[action.operation] })),
    };
  });
  return {
    workspace: { id: definition.id, key: definition.key, name: definition.name, pluralName: definition.pluralName, description: definition.description, category: definition.category, icon: definition.icon, displayFieldKey: definition.displayFieldKey, printTitle: definition.printTitle },
    administrator: p.systemAdministrator,
    dashboard: { visible: ent.canViewDashboard() },
    special: Object.fromEntries(SPECIAL_PERMISSIONS.map((permission) => [permission, ent.special(permission)])),
    tabs,
  };
}
export { OPERATIONAL_TAB_KEYS, STANDARD_OPERATIONS };
