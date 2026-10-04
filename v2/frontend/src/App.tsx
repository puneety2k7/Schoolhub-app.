import { useEffect, useState } from 'react';
import { api, ApiError, setCsrf } from './api';
import type { NavItem } from './types';
import { WorkspaceRuntime } from './runtime/WorkspaceRuntime';
import { WorkspaceManager } from './admin/WorkspaceManager';
import { AccessManager } from './admin/AccessManager';

type User = { userId: string; username: string; displayName: string; systemAdministrator: boolean };
type View = { kind: 'workspace'; key: string } | { kind: 'manager' } | { kind: 'access' } | { kind: 'home' };

function Login({ onDone }: { onDone: (user: User) => void }) {
  const [state, setState] = useState({ schoolSlug: '', username: '', password: '', schoolName: '', displayName: '' }), [setup, setSetup] = useState(false), [error, setError] = useState('');
  const submit = async () => {
    setError('');
    try {
      if (setup) await api('POST', '/api/setup', { schoolName: state.schoolName, schoolSlug: state.schoolSlug, username: state.username, displayName: state.displayName, password: state.password });
      const result = await api<{ user: User; csrfToken: string }>('POST', '/api/auth/login', { schoolSlug: state.schoolSlug, username: state.username, password: state.password });
      setCsrf(result.csrfToken); onDone(result.user);
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Sign-in failed.'); }
  };
  const input = (key: keyof typeof state, label: string, type = 'text') => <div className="field"><label htmlFor={key}>{label}</label><input id={key} type={type} value={state[key]} onChange={(e) => setState({ ...state, [key]: e.target.value })} /></div>;
  return <div className="login card"><h1>SchoolHub V2</h1><p className="muted">{setup ? 'First-run setup: create the school and its System Administrator.' : 'Sign in to continue.'}</p>
    {setup && input('schoolName', 'School name')}{input('schoolSlug', 'School ID')}{setup && input('displayName', 'Your name')}{input('username', 'Username')}{input('password', 'Password', 'password')}
    {error && <div className="notice error" role="alert">{error}</div>}
    <button className="btn primary" onClick={submit}>{setup ? 'Create school and sign in' : 'Sign in'}</button>
    <button className="link" onClick={() => setSetup(!setup)}>{setup ? 'I already have an account' : 'First server setup'}</button></div>;
}

export function App() {
  const [user, setUser] = useState<User | null>(null), [ready, setReady] = useState(false), [nav, setNav] = useState<NavItem[]>([]), [view, setView] = useState<View>({ kind: 'home' });
  useEffect(() => { api<{ user: User; csrfToken: string }>('GET', '/api/auth/me').then((r) => { setCsrf(r.csrfToken); setUser(r.user); }).catch(() => undefined).finally(() => setReady(true)); }, []);
  useEffect(() => { if (user) api<NavItem[]>('GET', '/api/workspaces').then(setNav).catch(() => setNav([])); }, [user, view]);
  if (!ready) return null;
  if (!user) return <Login onDone={setUser} />;
  const groups = [...new Set(nav.map((item) => item.category))];
  return (
    <div className="app">
      <aside className="sidebar"><div className="brand">SchoolHub <span>V2</span></div>
        {groups.map((group) => <div key={group}><div className="group">{group}</div>{nav.filter((i) => i.category === group).map((item) => <button key={item.key} data-nav={item.key} className={view.kind === 'workspace' && view.key === item.key ? 'active' : ''} onClick={() => setView({ kind: 'workspace', key: item.key })}>{item.pluralName}</button>)}</div>)}
        {user.systemAdministrator && <div><div className="group">Administration</div><button data-nav="manager" className={view.kind === 'manager' ? 'active' : ''} onClick={() => setView({ kind: 'manager' })}>Workspace Manager</button><button data-nav="access" className={view.kind === 'access' ? 'active' : ''} onClick={() => setView({ kind: 'access' })}>Users & Access</button></div>}
        <div className="user"><div>{user.displayName}</div><div className="muted small">{user.systemAdministrator ? 'System Administrator' : user.username}</div><button className="link" onClick={async () => { await api('POST', '/api/auth/logout', {}); setUser(null); setNav([]); setView({ kind: 'home' }); }}>Sign out</button></div></aside>
      <main className="content">
        {view.kind === 'workspace' && <WorkspaceRuntime key={view.key} workspaceKey={view.key} />}
        {view.kind === 'manager' && <WorkspaceManager />}
        {view.kind === 'access' && <AccessManager />}
        {view.kind === 'home' && <div className="notice">{nav.length ? 'Choose a workspace from the menu.' : user.systemAdministrator ? 'No workspaces yet. Create one in Workspace Manager.' : 'You have not been given access to any workspace.'}</div>}
      </main>
    </div>
  );
}
