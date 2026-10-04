import type { OperationalTabKey } from './permissions.js';

/**
 * The universal standard actions, their lifecycle rules and the permissions they require.
 * This single table is the authority for BOTH the backend (authorization) and the frontend (which controls to render).
 */
export const STANDARD_OPERATIONS = ['view', 'add', 'edit', 'print', 'archive', 'restore', 'permanent_delete'] as const;
export type StandardOperation = (typeof STANDARD_OPERATIONS)[number];

export type RecordState = 'Active' | 'Archived';
/** `None` is the tab toolbar (no record): only Add lives there. */
export type ActionState = RecordState | 'None';

export const OPERATION_LABELS: Readonly<Record<StandardOperation, string>> = {
  view: 'View', add: 'Add', edit: 'Edit', print: 'Print', archive: 'Archive', restore: 'Restore', permanent_delete: 'Permanent Delete',
};

/** Lifecycle: which operations exist for which record state. Normal DELETE is Archive; nothing here physically deletes an Active record. */
export const OPERATION_STATES: Readonly<Record<StandardOperation, readonly ActionState[]>> = {
  add: ['None'],
  view: ['Active', 'Archived'],
  edit: ['Active'],
  print: ['Active', 'Archived'],
  archive: ['Active'],
  restore: ['Archived'],
  permanent_delete: ['Archived'],
};

export function operationsForState(state: ActionState): StandardOperation[] {
  return STANDARD_OPERATIONS.filter((operation) => OPERATION_STATES[operation].includes(state));
}

/**
 * Permission requirements per operation: every listed selection must be held (AND).
 * Selections are `TAB|PERMISSION`; `<tab>` is replaced by the tab being operated on.
 */
export function requiredSelections(operation: StandardOperation, tab: OperationalTabKey): string[] {
  switch (operation) {
    case 'view': return [`${tab}|VIEW`];
    case 'add': return [`${tab}|ADD`];
    case 'edit': return [`${tab}|EDIT`];
    case 'print': return [`${tab}|PRINT`];
    case 'archive': return [`${tab}|DELETE`];
    case 'restore': return [`${tab}|VIEW`, 'SPECIAL|VIEW_ARCHIVED_RECORDS', 'SPECIAL|RESTORE_ARCHIVED_RECORDS'];
    case 'permanent_delete': return [`${tab}|DELETE`, 'SPECIAL|PERMANENT_DELETE'];
  }
}
