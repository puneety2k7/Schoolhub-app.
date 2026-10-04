import { describe, expect, it } from 'vitest';
import { selectActions } from './actions';

const all = ['view', 'add', 'edit', 'print', 'archive', 'restore', 'permanent_delete'].map((operation) => ({ operation: operation as any, label: operation }));
const ops = (tab: { actions: any[] }, state: any) => selectActions(tab, state).map((a) => a.operation);

describe('universal action selection', () => {
  const tab = { actions: all };
  it('Add exists only on the tab toolbar', () => { expect(ops(tab, 'None')).toEqual(['add']); expect(ops(tab, 'Active')).not.toContain('add'); });
  it('Active record: View, Edit, Print, Archive; no Restore / Permanent Delete', () => expect(ops(tab, 'Active')).toEqual(['view', 'edit', 'print', 'archive']));
  it('Archived record: View, Print, Restore, Permanent Delete; no Archive', () => expect(ops(tab, 'Archived')).toEqual(['view', 'print', 'restore', 'permanent_delete']));
  it('never invents an action the backend did not permit', () => expect(ops({ actions: all.filter((a) => a.operation === 'view') }, 'Active')).toEqual(['view']));
});
