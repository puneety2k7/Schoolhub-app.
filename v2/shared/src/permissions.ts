/**
 * The universal permission catalogue. Every operational workspace has exactly this catalogue:
 *   Dashboard: VIEW                                   = 1
 *   MAIN, GRID_1, GRID_2, GRID_3: VIEW ADD EDIT DELETE PRINT = 20
 *   Special permissions                                = 20
 *                                                TOTAL = 41
 * Nothing in the platform invents a workspace-specific permission key for a standard operation.
 */
export const OPERATIONAL_TAB_KEYS = ['MAIN', 'GRID_1', 'GRID_2', 'GRID_3'] as const;
export type OperationalTabKey = (typeof OPERATIONAL_TAB_KEYS)[number];

export const DASHBOARD_TAB_KEY = 'DASHBOARD' as const;
export const SPECIAL_TAB_KEY = 'SPECIAL' as const;
export const ROLE_TAB_KEYS = [DASHBOARD_TAB_KEY, ...OPERATIONAL_TAB_KEYS, SPECIAL_TAB_KEY] as const;
export type RoleTabKey = (typeof ROLE_TAB_KEYS)[number];

export const NORMAL_PERMISSIONS = ['VIEW', 'ADD', 'EDIT', 'DELETE', 'PRINT'] as const;
export type NormalPermission = (typeof NORMAL_PERMISSIONS)[number];

export const SPECIAL_PERMISSIONS = [
  'WORKSPACE_ADMINISTRATOR', 'IMPORT_RECORDS', 'VIEW_CHANGE_LOG', 'VIEW_ARCHIVED_RECORDS', 'RESTORE_ARCHIVED_RECORDS',
  'PERMANENT_DELETE', 'VIEW_RECORDS_OWNED_BY_OTHERS', 'VIEW_ASSIGNED_RECORDS', 'ASSIGN_RECORDS', 'CHANGE_RECORD_OWNER',
  'PUBLISH', 'UNPUBLISH', 'ACKNOWLEDGE', 'SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'CANCEL', 'OVERRIDE_RECORD_LOCKS',
] as const;
export type SpecialPermission = (typeof SPECIAL_PERMISSIONS)[number];

export type PermissionSelection = { tabKey: RoleTabKey; permissionKey: string };

/** A selection is written `TAB|PERMISSION`, e.g. `GRID_1|VIEW`, `DASHBOARD|VIEW`, `SPECIAL|PERMANENT_DELETE`. */
export const selectionKey = (tabKey: RoleTabKey, permissionKey: string) => `${tabKey}|${permissionKey}`;

/** Every selection a workspace role can hold: exactly 41. */
export function allSelections(): PermissionSelection[] {
  return [
    { tabKey: DASHBOARD_TAB_KEY, permissionKey: 'VIEW' },
    ...OPERATIONAL_TAB_KEYS.flatMap((tabKey) => NORMAL_PERMISSIONS.map((permissionKey) => ({ tabKey, permissionKey }))),
    ...SPECIAL_PERMISSIONS.map((permissionKey) => ({ tabKey: SPECIAL_TAB_KEY, permissionKey })),
  ];
}
export const PERMISSION_COUNT = 41;

export function isValidSelection(selection: PermissionSelection): boolean {
  const { tabKey, permissionKey } = selection;
  if (tabKey === DASHBOARD_TAB_KEY) return permissionKey === 'VIEW';
  if (tabKey === SPECIAL_TAB_KEY) return (SPECIAL_PERMISSIONS as readonly string[]).includes(permissionKey);
  if ((OPERATIONAL_TAB_KEYS as readonly string[]).includes(tabKey)) return (NORMAL_PERMISSIONS as readonly string[]).includes(permissionKey);
  return false;
}

export const SPECIAL_PERMISSION_LABELS: Readonly<Record<SpecialPermission, string>> = {
  WORKSPACE_ADMINISTRATOR: 'Workspace Administrator', IMPORT_RECORDS: 'Import Records', VIEW_CHANGE_LOG: 'View Change Log',
  VIEW_ARCHIVED_RECORDS: 'View Archived Records', RESTORE_ARCHIVED_RECORDS: 'Restore Archived Records', PERMANENT_DELETE: 'Permanent Delete',
  VIEW_RECORDS_OWNED_BY_OTHERS: 'View Records Owned by Others', VIEW_ASSIGNED_RECORDS: 'View Assigned Records', ASSIGN_RECORDS: 'Assign Records',
  CHANGE_RECORD_OWNER: 'Change Record Owner', PUBLISH: 'Publish', UNPUBLISH: 'Unpublish', ACKNOWLEDGE: 'Acknowledge', SUBMIT: 'Submit',
  REVIEW: 'Review', APPROVE: 'Approve', REJECT: 'Reject', RETURN: 'Return', CANCEL: 'Cancel', OVERRIDE_RECORD_LOCKS: 'Override Record Locks',
};
