import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Runtime } from '../types';
import { Dashboard } from './Dashboard';
import { RecordsTab } from './RecordsTab';

/** The Universal Workspace Runtime: one shell for every operational workspace. Renders only from the backend definition. */
export function WorkspaceRuntime({ workspaceKey }: { workspaceKey: string }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null), [error, setError] = useState(''), [active, setActive] = useState('');
  useEffect(() => {
    setRuntime(null); setError('');
    api<Runtime>('GET', `/api/workspaces/${workspaceKey}/runtime`).then((data) => {
      setRuntime(data);
      setActive(data.dashboard.visible ? 'DASHBOARD' : data.tabs.find((tab) => tab.visible)?.key ?? '');
    }).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'The workspace could not be loaded.'));
  }, [workspaceKey]);
  if (error) return <div className="notice error">{error}</div>;
  if (!runtime) return <div className="muted">Loading…</div>;
  const tabs = [...(runtime.dashboard.visible ? [{ key: 'DASHBOARD', label: 'Dashboard' }] : []), ...runtime.tabs.filter((tab) => tab.visible).map((tab) => ({ key: tab.key, label: tab.label }))];
  const current = runtime.tabs.find((tab) => tab.key === active);
  return (
    <div className="workspace" data-testid="workspace">
      <header className="page-head"><div className="eyebrow">{runtime.workspace.category}</div><h2>{runtime.workspace.pluralName}</h2>{runtime.workspace.description && <p className="muted">{runtime.workspace.description}</p>}</header>
      {tabs.length === 0 ? <div className="notice">You do not have access to any part of this workspace.</div> : (
        <>
          <div className="tabs" role="tablist">{tabs.map((tab) => <button key={tab.key} role="tab" aria-selected={tab.key === active} className={tab.key === active ? 'active' : ''} data-tab={tab.key} onClick={() => setActive(tab.key)}>{tab.label}</button>)}</div>
          <div className="tab-body">{active === 'DASHBOARD' ? <Dashboard runtime={runtime} /> : current ? <RecordsTab key={current.key} runtime={runtime} tab={current} /> : null}</div>
        </>
      )}
    </div>
  );
}
