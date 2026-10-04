import { useCallback, useEffect, useMemo, useState } from 'react';
import { OPERATION_LABELS, type StandardOperation } from '@shared/index';
import { api, ApiError } from '../api';
import type { RecordItem, Runtime, RuntimeTab } from '../types';
import { selectActions } from './actions';
import { arrange, displayValue, FieldInput, type RefOptions, type Values } from './fields';

type Mode = 'add' | 'view' | 'edit';

/** ActionRenderer: renders buttons straight from the selected standard actions. Nothing is inferred from the page. */
function ActionRenderer({ actions, onInvoke }: { actions: { operation: StandardOperation; label: string }[]; onInvoke: (operation: StandardOperation) => void }) {
  return <span className="actions">{actions.map((action) => (
    <button key={action.operation} type="button" data-op={action.operation}
      className={'btn small' + (action.operation === 'add' ? ' primary' : '') + (action.operation === 'archive' || action.operation === 'permanent_delete' ? ' danger' : '')}
      onClick={() => onInvoke(action.operation)}>{action.label}</button>
  ))}</span>;
}

/** Form dialog: opens over the Grid (which stays visible). Add = blank new record of THIS tab; View = read-only; Edit = populated. */
function FormDialog({ runtime, tab, mode, record, refLabels, onClose, onSaved }: { runtime: Runtime; tab: RuntimeTab; mode: Mode; record: RecordItem | null; refLabels: Record<string, string>; onClose: () => void; onSaved: () => void }) {
  const fields = useMemo(() => tab.sections.flatMap((section) => section.fields), [tab]);
  const groups = useMemo(() => arrange(tab.sections, tab.form), [tab]);
  const [values, setValues] = useState<Values>(() => mode === 'add' ? Object.fromEntries(fields.filter((f) => f.defaultValue !== null && f.defaultValue !== undefined && !f.readOnly).map((f) => [f.key, f.defaultValue])) : { ...(record?.values ?? {}) });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [refOptions, setRefOptions] = useState<RefOptions>({});
  useEffect(() => {
    if (mode === 'view') return;
    for (const field of fields.filter((f) => f.type === 'reference')) api<{ id: string; label: string }[]>('GET', `/api/workspaces/${runtime.workspace.key}/reference-options/${field.key}`).then((options) => setRefOptions((current) => ({ ...current, [field.key]: options }))).catch(() => undefined);
  }, [fields, mode, runtime.workspace.key]);
  const title = `${mode === 'add' ? 'Add' : mode === 'edit' ? 'Edit' : 'View'} — ${tab.label}`;
  const save = async () => {
    setBusy(true); setError('');
    try {
      const writable = Object.fromEntries(fields.filter((f) => f.visible && !f.readOnly).map((f) => [f.key, values[f.key] ?? null]));
      const base = `/api/workspaces/${runtime.workspace.key}/tabs/${tab.key}/records`;
      if (mode === 'add') await api('POST', base, { values: writable });
      else await api('PATCH', `${base}/${record!.id}`, { version: record!.version, values: writable });
      onSaved();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The record could not be saved.'); setBusy(false); }
  };
  return (
    <div className="overlay" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} data-testid="form-dialog" data-mode={mode}>
        <header><h3>{title}{tab.form ? ` · ${tab.form.name}` : ''}</h3><button className="btn small" onClick={onClose} aria-label="Close">×</button></header>
        <div className="dialog-body">
          {groups.length === 0 && <p className="muted">No fields are configured for this tab. Add them in Workspace Manager.</p>}
          {groups.map((group) => (
            <section key={group.title} className="form-section"><h4>{group.title}</h4><div className="form-grid">
              {group.fields.map((field) => mode === 'view'
                ? <div key={field.key}><b>{field.label}</b><div>{displayValue(field, values[field.key], refLabels)}</div></div>
                : field.readOnly ? <div key={field.key}><b>{field.label}</b><div>{displayValue(field, values[field.key], refLabels)}</div></div>
                  : <FieldInput key={field.key} field={field} value={values[field.key]} refOptions={refOptions} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />)}
            </div></section>
          ))}
          {error && <div className="notice error" role="alert">{error}</div>}
        </div>
        <footer><button className="btn" onClick={onClose}>{mode === 'view' ? 'Close' : 'Cancel'}</button>{mode !== 'view' && <button className="btn primary" disabled={busy} onClick={save}>Save</button>}</footer>
      </div>
    </div>
  );
}

function printRecord(runtime: Runtime, tab: RuntimeTab, record: RecordItem, refLabels: Record<string, string>) {
  const rows = tab.sections.flatMap((section) => section.fields).filter((field) => field.printVisible).map((field) => `<tr><th>${esc(field.label)}</th><td>${esc(displayValue(field, record.values[field.key], refLabels))}</td></tr>`).join('');
  const frame = document.createElement('iframe'); frame.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.append(frame);
  const doc = frame.contentDocument!; doc.open();
  doc.write(`<html><head><title>${esc(runtime.workspace.printTitle || runtime.workspace.name)}</title><style>body{font:14px system-ui;padding:24px}th{text-align:left;padding:4px 16px 4px 0;vertical-align:top}</style></head><body><h2>${esc(runtime.workspace.printTitle || runtime.workspace.name)} — ${esc(tab.label)}</h2><table>${rows}</table></body></html>`);
  doc.close(); frame.contentWindow!.focus(); frame.contentWindow!.print(); setTimeout(() => frame.remove(), 2000);
}
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** MAIN and every Grid tab render through this one component: Toolbar + DataGrid + ActionRenderer + FormDialog. */
export function RecordsTab({ runtime, tab }: { runtime: Runtime; tab: RuntimeTab }) {
  const [items, setItems] = useState<RecordItem[]>([]), [refLabels, setRefLabels] = useState<Record<string, string>>({}), [error, setError] = useState(''), [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ mode: Mode; record: RecordItem | null } | null>(null), [loading, setLoading] = useState(true);
  const base = `/api/workspaces/${runtime.workspace.key}/tabs/${tab.key}/records`;
  const columns = useMemo(() => tab.sections.flatMap((section) => section.fields), [tab]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api<{ items: RecordItem[]; references: Record<string, string> }>('GET', base); setItems(data.items); setRefLabels(data.references); setError(''); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The records could not be loaded.'); }
    setLoading(false);
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase(), searchable = columns.filter((field) => field.searchable);
    return needle ? items.filter((item) => searchable.some((field) => displayValue(field, item.values[field.key], refLabels).toLowerCase().includes(needle))) : items;
  }, [items, search, columns, refLabels]);

  const invoke = async (operation: StandardOperation, record: RecordItem | null) => {
    setError('');
    try {
      if (operation === 'add') return setDialog({ mode: 'add', record: null });
      if (!record) return;
      if (operation === 'view') return setDialog({ mode: 'view', record });
      if (operation === 'edit') return setDialog({ mode: 'edit', record });
      if (operation === 'print') return printRecord(runtime, tab, record, refLabels);
      if (operation === 'archive') { if (!window.confirm('Archive this record?')) return; await api('POST', `${base}/${record.id}/archive`, { version: record.version }); }
      if (operation === 'restore') { await api('POST', `${base}/${record.id}/restore`, { version: record.version }); }
      if (operation === 'permanent_delete') { if (!window.confirm('Permanently delete this archived record? This cannot be undone.')) return; await api('DELETE', `${base}/${record.id}`, { version: record.version, confirmation: 'DELETE' }); }
      await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : `${OPERATION_LABELS[operation]} failed.`); }
  };

  return (
    <div className="records-tab" data-testid={`tab-${tab.key}`}>
      <div className="toolbar">
        <h3>{tab.label}</h3>
        <input className="search" placeholder="Search…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search" />
        <ActionRenderer actions={selectActions(tab, 'None')} onInvoke={(operation) => invoke(operation, null)} />
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {columns.length === 0 ? <div className="notice">No fields are configured for this tab yet. Add sections and fields in Workspace Manager.</div> : (
        <div className="table-wrap"><table className="grid">
          <thead><tr>{columns.map((field) => <th key={field.key}>{field.label}</th>)}<th>Actions</th></tr></thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id} data-state={item.state} data-record-id={item.id}>
                {columns.map((field) => <td key={field.key}>{displayValue(field, item.values[field.key], refLabels)}</td>)}
                <td>{item.state === 'Archived' && <span className="badge">Archived</span>}<ActionRenderer actions={selectActions(tab, item.state)} onInvoke={(operation) => invoke(operation, item)} /></td>
              </tr>
            ))}
            {!loading && visibleItems.length === 0 && <tr><td colSpan={columns.length + 1} className="muted center">No records.</td></tr>}
          </tbody>
        </table></div>
      )}
      {dialog && <FormDialog runtime={runtime} tab={tab} mode={dialog.mode} record={dialog.record} refLabels={refLabels} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); }} />}
    </div>
  );
}
