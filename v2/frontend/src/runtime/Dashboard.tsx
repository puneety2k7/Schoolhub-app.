import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Runtime } from '../types';

type Component = { id: string; type: 'metric' | 'table'; title: string; status: 'ok' | 'forbidden'; value?: number | null; columns?: { key: string; label: string }[]; rows?: { id: string; values: Record<string, unknown> }[] };

/** Dashboard engine view: Metric and Table components, configured in Workspace Manager. */
export function Dashboard({ runtime }: { runtime: Runtime }) {
  const [components, setComponents] = useState<Component[] | null>(null), [error, setError] = useState('');
  useEffect(() => { api<Component[]>('GET', `/api/workspaces/${runtime.workspace.key}/dashboard`).then(setComponents).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Dashboard failed.')); }, [runtime.workspace.key]);
  if (error) return <div className="notice error">{error}</div>;
  if (!components) return <div className="muted">Loading…</div>;
  if (!components.length) return <div className="notice" data-testid="dashboard-empty">This dashboard has no components yet. Configure it in Workspace Manager.</div>;
  return (
    <div className="dashboard" data-testid="dashboard">
      {components.map((component) => (
        <section key={component.id} className={'card dash-' + component.type} data-testid={`dash-${component.type}`}>
          <h4>{component.title}</h4>
          {component.status === 'forbidden' ? <p className="muted">You do not have access to this component's source data.</p>
            : component.type === 'metric' ? <div className="metric">{component.value ?? '—'}</div>
              : <table className="grid"><thead><tr>{component.columns!.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>
                {component.rows!.map((row) => <tr key={row.id}>{component.columns!.map((c) => <td key={c.key}>{String(row.values[c.key] ?? '—')}</td>)}</tr>)}
                {!component.rows!.length && <tr><td className="muted" colSpan={component.columns!.length}>No records.</td></tr>}</tbody></table>}
        </section>
      ))}
    </div>
  );
}
