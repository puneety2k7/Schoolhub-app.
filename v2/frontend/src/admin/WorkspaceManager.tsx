import { useCallback, useEffect, useState } from 'react';
import { FIELD_TYPES, FIELD_TYPE_LABELS, OPERATIONAL_TAB_KEYS, STANDARD_OPERATIONS, OPERATION_LABELS, type FieldType, type OperationalTabKey } from '@shared/index';
import { api, ApiError } from '../api';

type Def = any;
const errText = (caught: unknown) => (caught instanceof ApiError ? caught.message : 'The change failed.');

function useDef(id: string) {
  const [def, setDef] = useState<Def>(null), [error, setError] = useState('');
  const reload = useCallback(async () => { try { setDef(await api('GET', `/api/admin/workspaces/${id}`)); } catch (caught) { setError(errText(caught)); } }, [id]);
  useEffect(() => { void reload(); }, [reload]);
  const run = async (work: () => Promise<unknown>) => { setError(''); try { await work(); await reload(); } catch (caught) { setError(errText(caught)); } };
  return { def, error, run, reload };
}

function General({ def, run }: { def: Def; run: (w: () => Promise<unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ name: def.name, pluralName: def.pluralName, description: def.description, category: def.category, displayFieldKey: def.displayFieldKey ?? '', printTitle: def.printTitle });
  const fields = def.tabs.flatMap((tab: any) => tab.sections.flatMap((section: any) => section.fields));
  return <section className="card"><h3>General</h3><div className="form-grid">
    {(['name', 'pluralName', 'description', 'category', 'printTitle'] as const).map((key) => <div className="field" key={key}><label>{key}</label><input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} aria-label={key} /></div>)}
    <div className="field"><label>Display field (labels this record when referenced)</label><select value={form.displayFieldKey} onChange={(e) => setForm({ ...form, displayFieldKey: e.target.value })}><option value="">(automatic)</option>{fields.map((f: any) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
  </div><button className="btn primary" onClick={() => run(() => api('PATCH', `/api/admin/workspaces/${def.id}`, { ...form, displayFieldKey: form.displayFieldKey || null }))}>Save general settings</button></section>;
}

function FieldRow({ def, field, run }: { def: Def; field: any; run: (w: () => Promise<unknown>) => Promise<void> }) {
  const patch = (body: object) => run(() => api('PATCH', `/api/admin/workspaces/${def.id}/fields/${field.id}`, body));
  return <tr data-field={field.key}><td><b>{field.label}</b><div className="muted small">{field.key} · {FIELD_TYPE_LABELS[field.type as FieldType]}</div></td>
    {(['required', 'readOnly', 'visible', 'searchable', 'filterable', 'printVisible'] as const).map((flag) => <td key={flag} className="center"><input type="checkbox" aria-label={`${field.key} ${flag}`} checked={field[flag]} onChange={(e) => patch({ [flag]: e.target.checked })} /></td>)}
    <td><button className="btn small danger" onClick={() => window.confirm('Delete this field?') && run(() => api('DELETE', `/api/admin/workspaces/${def.id}/fields/${field.id}`))}>Delete</button></td></tr>;
}

function AddField({ def, section, run }: { def: Def; section: any; run: (w: () => Promise<unknown>) => Promise<void> }) {
  const [state, setState] = useState({ key: '', label: '', type: 'text' as FieldType, options: '', ref: '', required: false }), [workspaces, setWorkspaces] = useState<any[]>([]);
  useEffect(() => { if (state.type === 'reference' && !workspaces.length) api<any[]>('GET', '/api/admin/workspaces').then(setWorkspaces).catch(() => undefined); }, [state.type, workspaces.length]);
  const submit = () => run(async () => {
    await api('POST', `/api/admin/workspaces/${def.id}/fields`, {
      sectionId: section.id, key: state.key, label: state.label, type: state.type, required: state.required,
      ...(state.type === 'select' ? { options: state.options.split(',').map((s) => s.trim()).filter(Boolean).map((v) => ({ value: v, label: v })) } : {}),
      ...(state.type === 'reference' ? { referenceWorkspaceId: state.ref } : {}),
    });
    setState({ key: '', label: '', type: 'text', options: '', ref: '', required: false });
  });
  return <div className="inline-form">
    <input placeholder="key (e.g. full_name)" value={state.key} onChange={(e) => setState({ ...state, key: e.target.value })} aria-label="new field key" />
    <input placeholder="Label" value={state.label} onChange={(e) => setState({ ...state, label: e.target.value })} aria-label="new field label" />
    <select value={state.type} onChange={(e) => setState({ ...state, type: e.target.value as FieldType })} aria-label="new field type">{FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}</select>
    {state.type === 'select' && <input placeholder="choices, comma separated" value={state.options} onChange={(e) => setState({ ...state, options: e.target.value })} aria-label="choices" />}
    {state.type === 'reference' && <select value={state.ref} onChange={(e) => setState({ ...state, ref: e.target.value })} aria-label="target workspace"><option value="">Target workspace…</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
    <label className="check"><input type="checkbox" checked={state.required} onChange={(e) => setState({ ...state, required: e.target.checked })} /> Required</label>
    <button className="btn small primary" onClick={submit} aria-label="add field">Add field</button></div>;
}

function Tabs({ def, run }: { def: Def; run: (w: () => Promise<unknown>) => Promise<void> }) {
  const [sectionName, setSectionName] = useState<Record<string, string>>({});
  return <>{def.tabs.map((tab: any) => (
    <section className="card" key={tab.key} data-wm-tab={tab.key}>
      <h3>{tab.key} <span className="muted">— {tab.label}</span></h3>
      <div className="inline-form"><input defaultValue={tab.label} aria-label={`${tab.key} label`} onBlur={(e) => e.target.value !== tab.label && run(() => api('PATCH', `/api/admin/workspaces/${def.id}/tabs/${tab.key}`, { label: e.target.value }))} />
        <select value={tab.formId ?? ''} aria-label={`${tab.key} form`} onChange={(e) => run(() => api('PATCH', `/api/admin/workspaces/${def.id}/tabs/${tab.key}`, { formId: e.target.value || null }))}><option value="">No Form (use sections)</option>{def.forms.map((f: any) => <option key={f.id} value={f.id}>Form: {f.name}</option>)}</select></div>
      {tab.sections.map((section: any) => (
        <div key={section.id} className="section-box"><h4>{section.name}</h4>
          <table className="grid"><thead><tr><th>Field</th><th>Required</th><th>Read-only</th><th>Visible</th><th>Search</th><th>Filter</th><th>Print</th><th /></tr></thead>
            <tbody>{section.fields.map((field: any) => <FieldRow key={field.id} def={def} field={field} run={run} />)}</tbody></table>
          <AddField def={def} section={section} run={run} />
        </div>))}
      <div className="inline-form"><input placeholder="New section name" value={sectionName[tab.key] ?? ''} aria-label={`${tab.key} new section`} onChange={(e) => setSectionName({ ...sectionName, [tab.key]: e.target.value })} />
        <button className="btn small" aria-label={`${tab.key} add section`} onClick={() => run(async () => { await api('POST', `/api/admin/workspaces/${def.id}/sections`, { tabKey: tab.key, name: sectionName[tab.key] }); setSectionName({ ...sectionName, [tab.key]: '' }); })}>Add section</button></div>
    </section>))}</>;
}

function Forms({ def, run }: { def: Def; run: (w: () => Promise<unknown>) => Promise<void> }) {
  const [name, setName] = useState(''), [tab, setTab] = useState<OperationalTabKey>('MAIN'), [picked, setPicked] = useState<string[]>([]);
  const fields = def.tabs.find((t: any) => t.key === tab).sections.flatMap((s: any) => s.fields);
  return <section className="card"><h3>Forms</h3>
    {def.forms.map((form: any) => <div key={form.id} className="row">{form.name} <span className="muted small">{form.layout.sections.map((s: any) => s.fieldKeys.join(', ')).join(' | ')}</span>
      <button className="btn small danger" onClick={() => run(() => api('DELETE', `/api/admin/workspaces/${def.id}/forms/${form.id}`))}>Delete</button></div>)}
    <div className="inline-form"><input placeholder="Form name" value={name} onChange={(e) => setName(e.target.value)} aria-label="form name" />
      <select value={tab} onChange={(e) => { setTab(e.target.value as OperationalTabKey); setPicked([]); }} aria-label="form tab">{OPERATIONAL_TAB_KEYS.map((t) => <option key={t}>{t}</option>)}</select>
      {fields.map((f: any) => <label key={f.key} className="check"><input type="checkbox" checked={picked.includes(f.key)} onChange={(e) => setPicked(e.target.checked ? [...picked, f.key] : picked.filter((k) => k !== f.key))} /> {f.label}</label>)}
      <button className="btn small primary" aria-label="create form" onClick={() => run(async () => { await api('POST', `/api/admin/workspaces/${def.id}/forms`, { name, layout: { sections: [{ title: 'Details', fieldKeys: picked }] } }); setName(''); setPicked([]); })}>Create form</button></div></section>;
}

function Actions({ def, run }: { def: Def; run: (w: () => Promise<unknown>) => Promise<void> }) {
  return <section className="card"><h3>Standard actions</h3><p className="muted small">Meaning and permissions are universal; here you only enable or disable an action per tab.</p>
    <table className="grid"><thead><tr><th>Tab</th>{STANDARD_OPERATIONS.map((o) => <th key={o}>{OPERATION_LABELS[o]}</th>)}</tr></thead><tbody>
      {OPERATIONAL_TAB_KEYS.map((tab) => <tr key={tab}><td>{tab}</td>{STANDARD_OPERATIONS.map((op) => { const setting = def.actions.find((a: any) => a.tabKey === tab && a.operation === op); return <td key={op} className="center"><input type="checkbox" aria-label={`${tab} ${op}`} checked={setting?.enabled ?? false} onChange={(e) => run(() => api('PATCH', `/api/admin/workspaces/${def.id}/actions/${tab}/${op}`, { enabled: e.target.checked }))} /></td>; })}</tr>)}</tbody></table></section>;
}

function DashboardConfig({ def, run }: { def: Def; run: (w: () => Promise<unknown>) => Promise<void> }) {
  const [state, setState] = useState({ type: 'metric', title: '', sourceTab: 'MAIN' as OperationalTabKey, aggregation: 'count', fieldKey: '', fieldKeys: [] as string[] });
  const fields = def.tabs.find((t: any) => t.key === state.sourceTab).sections.flatMap((s: any) => s.fields);
  const create = () => run(async () => {
    const config = state.type === 'metric' ? { sourceTab: state.sourceTab, aggregation: state.aggregation, ...(state.aggregation !== 'count' ? { fieldKey: state.fieldKey } : {}) } : { sourceTab: state.sourceTab, fieldKeys: state.fieldKeys, limit: 10 };
    await api('POST', `/api/admin/workspaces/${def.id}/components`, { type: state.type, title: state.title, config });
    setState({ ...state, title: '' });
  });
  return <section className="card"><h3>Dashboard components</h3>
    {def.components.map((c: any) => <div key={c.id} className="row">{c.title} <span className="muted small">{c.type} · {c.config.sourceTab}</span><button className="btn small danger" onClick={() => run(() => api('DELETE', `/api/admin/workspaces/${def.id}/components/${c.id}`))}>Delete</button></div>)}
    <div className="inline-form"><select value={state.type} onChange={(e) => setState({ ...state, type: e.target.value })} aria-label="component type"><option value="metric">Metric</option><option value="table">Table</option></select>
      <input placeholder="Title" value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} aria-label="component title" />
      <select value={state.sourceTab} onChange={(e) => setState({ ...state, sourceTab: e.target.value as OperationalTabKey, fieldKey: '', fieldKeys: [] })} aria-label="source tab">{OPERATIONAL_TAB_KEYS.map((t) => <option key={t}>{t}</option>)}</select>
      {state.type === 'metric' ? <>
        <select value={state.aggregation} onChange={(e) => setState({ ...state, aggregation: e.target.value })} aria-label="aggregation">{['count', 'sum', 'avg', 'min', 'max'].map((a) => <option key={a}>{a}</option>)}</select>
        {state.aggregation !== 'count' && <select value={state.fieldKey} onChange={(e) => setState({ ...state, fieldKey: e.target.value })} aria-label="metric field"><option value="">Numeric field…</option>{fields.filter((f: any) => ['integer', 'decimal'].includes(f.type)).map((f: any) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>}
      </> : fields.map((f: any) => <label key={f.key} className="check"><input type="checkbox" checked={state.fieldKeys.includes(f.key)} onChange={(e) => setState({ ...state, fieldKeys: e.target.checked ? [...state.fieldKeys, f.key] : state.fieldKeys.filter((k) => k !== f.key) })} /> {f.label}</label>)}
      <button className="btn small primary" onClick={create} aria-label="add component">Add component</button></div></section>;
}

export function WorkspaceManager() {
  const [list, setList] = useState<any[]>([]), [selected, setSelected] = useState(''), [create, setCreate] = useState({ key: '', name: '', pluralName: '' }), [error, setError] = useState('');
  const refresh = useCallback(() => api<any[]>('GET', '/api/admin/workspaces').then(setList), []);
  useEffect(() => { void refresh(); }, [refresh]);
  const { def, error: defError, run } = useDef(selected);
  return (
    <div className="manager" data-testid="workspace-manager">
      <aside className="card"><h3>Workspaces</h3>
        {list.map((w) => <button key={w.id} className={'list-item' + (w.id === selected ? ' active' : '')} onClick={() => setSelected(w.id)}>{w.name} <span className="muted small">{w.key}</span></button>)}
        <h4>New workspace</h4>
        {(['key', 'name', 'pluralName'] as const).map((k) => <input key={k} placeholder={k} value={create[k]} onChange={(e) => setCreate({ ...create, [k]: e.target.value })} aria-label={`new workspace ${k}`} />)}
        <button className="btn primary" aria-label="create workspace" onClick={async () => { setError(''); try { const made = await api<any>('POST', '/api/admin/workspaces', create); setCreate({ key: '', name: '', pluralName: '' }); await refresh(); setSelected(made.id); } catch (c) { setError(errText(c)); } }}>Create workspace</button>
        {error && <div className="notice error">{error}</div>}</aside>
      <div className="manager-detail">
        {defError && <div className="notice error" role="alert">{defError}</div>}
        {def ? <><h2>{def.name} <span className="muted small">{def.key}</span></h2><General key={def.version + 'g'} def={def} run={run} /><Tabs def={def} run={run} /><Forms def={def} run={run} /><Actions def={def} run={run} /><DashboardConfig def={def} run={run} /></> : <p className="muted">Choose or create a workspace.</p>}
      </div>
    </div>
  );
}
