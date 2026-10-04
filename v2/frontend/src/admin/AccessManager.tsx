import { useCallback, useEffect, useState } from 'react';
import { OPERATIONAL_TAB_KEYS, NORMAL_PERMISSIONS, SPECIAL_PERMISSIONS, SPECIAL_PERMISSION_LABELS, PERMISSION_COUNT, selectionKey } from '@shared/index';
import { api, ApiError } from '../api';

const errText = (caught: unknown) => (caught instanceof ApiError ? caught.message : 'The change failed.');

/** Users → Groups → Roles → the 41 workspace selections. There is no direct user permission. */
export function AccessManager() {
  const [data, setData] = useState<any>(null), [workspaces, setWorkspaces] = useState<any[]>([]), [error, setError] = useState('');
  const [user, setUser] = useState({ username: '', displayName: '', password: '' }), [groupName, setGroupName] = useState('');
  const [role, setRole] = useState({ workspaceId: '', name: '', picked: new Set<string>() });
  const reload = useCallback(async () => { setData(await api('GET', '/api/admin/access')); setWorkspaces(await api('GET', '/api/admin/workspaces')); }, []);
  useEffect(() => { void reload(); }, [reload]);
  const run = async (work: () => Promise<unknown>) => { setError(''); try { await work(); await reload(); } catch (c) { setError(errText(c)); } };
  if (!data) return <p className="muted">Loading…</p>;
  const toggle = (key: string, on: boolean) => { const next = new Set(role.picked); on ? next.add(key) : next.delete(key); setRole({ ...role, picked: next }); };
  const toSelections = () => [...role.picked].map((value) => { const [tabKey, permissionKey] = value.split('|'); return { tabKey, permissionKey }; });
  return (
    <div className="access" data-testid="access-manager">
      {error && <div className="notice error" role="alert">{error}</div>}
      <section className="card"><h3>Users</h3>
        {data.users.map((u: any) => <div className="row" key={u.id}>{u.displayName} <span className="muted small">{u.username}{u.systemAdministrator ? ' · System Administrator' : ''}</span></div>)}
        <div className="inline-form">{(['username', 'displayName', 'password'] as const).map((k) => <input key={k} type={k === 'password' ? 'password' : 'text'} placeholder={k} value={user[k]} onChange={(e) => setUser({ ...user, [k]: e.target.value })} aria-label={`user ${k}`} />)}
          <button className="btn small primary" aria-label="create user" onClick={() => run(async () => { await api('POST', '/api/admin/users', user); setUser({ username: '', displayName: '', password: '' }); })}>Create user</button></div></section>
      <section className="card"><h3>Groups</h3>
        {data.groups.map((g: any) => {
          const members = data.members.filter((m: any) => m.groupId === g.id).map((m: any) => m.userId), roles = data.groupRoles.filter((r: any) => r.groupId === g.id).map((r: any) => r.roleId);
          return <div key={g.id} className="section-box" data-group={g.name}><b>{g.name}</b>
            <div className="chips"><span className="muted small">Members:</span>{data.users.filter((u: any) => !u.systemAdministrator).map((u: any) => <label key={u.id} className="check"><input type="checkbox" aria-label={`${g.name} member ${u.username}`} checked={members.includes(u.id)} onChange={(e) => run(() => api('PUT', `/api/admin/groups/${g.id}/members`, { ids: e.target.checked ? [...members, u.id] : members.filter((id: string) => id !== u.id) }))} /> {u.username}</label>)}</div>
            <div className="chips"><span className="muted small">Roles:</span>{data.roles.map((r: any) => <label key={r.id} className="check"><input type="checkbox" aria-label={`${g.name} role ${r.name}`} checked={roles.includes(r.id)} onChange={(e) => run(() => api('PUT', `/api/admin/groups/${g.id}/roles`, { ids: e.target.checked ? [...roles, r.id] : roles.filter((id: string) => id !== r.id) }))} /> {r.name}</label>)}</div></div>;
        })}
        <div className="inline-form"><input placeholder="New group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} aria-label="group name" /><button className="btn small primary" aria-label="create group" onClick={() => run(async () => { await api('POST', '/api/admin/groups', { name: groupName }); setGroupName(''); })}>Create group</button></div></section>
      <section className="card"><h3>Roles <span className="muted small">({PERMISSION_COUNT} selections per workspace role)</span></h3>
        {data.roles.map((r: any) => <div className="row" key={r.id}>{r.name} <span className="muted small">{workspaces.find((w) => w.id === r.workspaceId)?.name} · {r.selections.length} selections</span></div>)}
        <div className="role-editor"><div className="inline-form"><select value={role.workspaceId} onChange={(e) => setRole({ ...role, workspaceId: e.target.value })} aria-label="role workspace"><option value="">Workspace…</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          <input placeholder="Role name" value={role.name} onChange={(e) => setRole({ ...role, name: e.target.value })} aria-label="role name" /></div>
          <table className="grid"><thead><tr><th>Dashboard</th>{OPERATIONAL_TAB_KEYS.map((t) => <th key={t}>{t}</th>)}</tr></thead><tbody>
            <tr><td><label className="check"><input type="checkbox" aria-label="DASHBOARD VIEW" checked={role.picked.has('DASHBOARD|VIEW')} onChange={(e) => toggle('DASHBOARD|VIEW', e.target.checked)} /> VIEW</label></td>
              {OPERATIONAL_TAB_KEYS.map((t) => <td key={t}>{NORMAL_PERMISSIONS.map((p) => <label key={p} className="check block"><input type="checkbox" aria-label={`${t} ${p}`} checked={role.picked.has(selectionKey(t, p))} onChange={(e) => toggle(selectionKey(t, p), e.target.checked)} /> {p}</label>)}</td>)}</tr></tbody></table>
          <div className="chips">{SPECIAL_PERMISSIONS.map((p) => <label key={p} className="check"><input type="checkbox" aria-label={`SPECIAL ${p}`} checked={role.picked.has(selectionKey('SPECIAL', p))} onChange={(e) => toggle(selectionKey('SPECIAL', p), e.target.checked)} /> {SPECIAL_PERMISSION_LABELS[p]}</label>)}</div>
          <button className="btn small primary" aria-label="create role" onClick={() => run(async () => { await api('POST', '/api/admin/roles', { workspaceId: role.workspaceId, name: role.name, selections: toSelections() }); setRole({ workspaceId: role.workspaceId, name: '', picked: new Set() }); })}>Create role</button></div></section>
    </div>
  );
}
