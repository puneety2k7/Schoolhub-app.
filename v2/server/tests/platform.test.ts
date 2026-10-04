import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { Database } from '../src/db/database.js';
import { resetTestDatabase } from '../src/db/migrate.js';
import { buildApp } from '../src/http/app.js';
import { allSelections, PERMISSION_COUNT, operationsForState, requiredSelections } from '../../shared/src/index.js';

const URL_ = process.env.TEST_DATABASE_URL ?? '';
const PASSWORD = 'Sup3r!SecretPass#1';
let db: Database, app: Awaited<ReturnType<typeof buildApp>>;

type Client = { call: (method: string, url: string, body?: unknown) => Promise<{ status: number; data: any; error: any }> };
async function client(username: string, password = PASSWORD): Promise<Client> {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { schoolSlug: 'test-school', username, password } });
  expect(login.statusCode).toBe(200);
  const cookie = String(login.headers['set-cookie']).split(';')[0]!, csrf = login.json().data.csrfToken;
  return {
    async call(method, url, body) {
      const res = await app.inject({ method: method as any, url, payload: body as any, headers: { cookie, 'x-csrf-token': csrf } });
      const json = res.body ? res.json() : {};
      return { status: res.statusCode, data: json.data, error: json.error };
    },
  };
}
const sel = (...items: string[]) => items.map((item) => { const [tabKey, permissionKey] = item.split('|'); return { tabKey, permissionKey }; });

let admin: Client, ws: { id: string; key: string }, sections: Record<string, string>;

/** Gives `username` the listed selections on the test workspace through User → Group → Role. */
async function grant(username: string, selections: string[]) {
  const a = (await admin.call('GET', '/api/admin/access')).data;
  let user = a.users.find((u: any) => u.username === username);
  if (!user) { const r = await admin.call('POST', '/api/admin/users', { username, displayName: username, password: PASSWORD }); expect(r.status).toBe(201); user = { id: r.data.id }; }
  const role = await admin.call('POST', '/api/admin/roles', { workspaceId: ws.id, name: `${username}-role`, selections: sel(...selections) });
  expect(role.status).toBe(201);
  const group = await admin.call('POST', '/api/admin/groups', { name: `${username}-group` });
  await admin.call('PUT', `/api/admin/groups/${group.data.id}/roles`, { ids: [role.data.id] });
  await admin.call('PUT', `/api/admin/groups/${group.data.id}/members`, { ids: [user.id] });
}

beforeAll(async () => {
  if (!URL_) return;
  db = new Database(URL_);
  await resetTestDatabase(db, URL_);
  app = await buildApp(loadConfig({ NODE_ENV: 'test', DATABASE_URL: URL_ } as any), db);
  const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { schoolName: 'Test School', schoolSlug: 'test-school', username: 'sysadmin', displayName: 'System Admin', password: PASSWORD } });
  expect(setup.statusCode).toBe(201);
  admin = await client('sysadmin');
  // A brand-new workspace defined ONLY through the Workspace Manager API: no workspace-specific code anywhere.
  const created = await admin.call('POST', '/api/admin/workspaces', { key: 'test-workspace', name: 'Test Item', pluralName: 'Test Items' });
  expect(created.status).toBe(201);
  ws = { id: created.data.id, key: created.data.key };
  sections = {};
  for (const tab of ['MAIN', 'GRID_1', 'GRID_2', 'GRID_3']) {
    sections[tab] = (await admin.call('POST', `/api/admin/workspaces/${ws.id}/sections`, { tabKey: tab, name: `${tab} details` })).data.id;
    const field = await admin.call('POST', `/api/admin/workspaces/${ws.id}/fields`, { sectionId: sections[tab], key: `name_${tab.toLowerCase()}`, label: `${tab} Name`, type: 'text', required: true, searchable: true });
    expect(field.status).toBe(201);
  }
  await admin.call('POST', `/api/admin/workspaces/${ws.id}/fields`, { sectionId: sections.MAIN, key: 'amount', label: 'Amount', type: 'integer' });
  await admin.call('PATCH', `/api/admin/workspaces/${ws.id}`, { displayFieldKey: 'name_main' });
});
afterAll(async () => { if (URL_) { await app.close(); await db.close(); } });

describe.skipIf(!URL_)('permission catalogue', () => {
  it('has exactly 41 universal selections: 1 dashboard + 20 tab + 20 special', () => {
    const all = allSelections();
    expect(all).toHaveLength(PERMISSION_COUNT);
    expect(all.filter((s) => s.tabKey === 'DASHBOARD')).toHaveLength(1);
    expect(all.filter((s) => ['MAIN', 'GRID_1', 'GRID_2', 'GRID_3'].includes(s.tabKey))).toHaveLength(20);
    expect(all.filter((s) => s.tabKey === 'SPECIAL')).toHaveLength(20);
  });
  it('maps standard actions to the required permissions and lifecycle states', () => {
    expect(requiredSelections('archive', 'GRID_2')).toEqual(['GRID_2|DELETE']);
    expect(requiredSelections('restore', 'MAIN')).toEqual(['MAIN|VIEW', 'SPECIAL|VIEW_ARCHIVED_RECORDS', 'SPECIAL|RESTORE_ARCHIVED_RECORDS']);
    expect(requiredSelections('permanent_delete', 'GRID_1')).toEqual(['GRID_1|DELETE', 'SPECIAL|PERMANENT_DELETE']);
    expect(operationsForState('Active')).toEqual(['view', 'edit', 'print', 'archive']);
    expect(operationsForState('Archived')).toEqual(['view', 'print', 'restore', 'permanent_delete']);
    expect(operationsForState('None')).toEqual(['add']);
  });
  it('rejects an invalid selection in the database and the API', async () => {
    const bad = await admin.call('POST', '/api/admin/roles', { workspaceId: ws.id, name: 'bad', selections: [{ tabKey: 'MAIN', permissionKey: 'PERMANENT_DELETE' }] });
    expect(bad.status).toBe(400);
  });
});

describe.skipIf(!URL_)('universal workspace contract (custom workspace, no workspace code)', () => {
  it('has the five-tab contract and seven standard actions on every tab', async () => {
    const runtime = (await admin.call('GET', `/api/workspaces/${ws.key}/runtime`)).data;
    expect(runtime.dashboard.visible).toBe(true);
    expect(runtime.tabs.map((t: any) => t.key)).toEqual(['MAIN', 'GRID_1', 'GRID_2', 'GRID_3']);
    for (const tab of runtime.tabs) expect(tab.actions.map((a: any) => a.operation)).toEqual(['view', 'add', 'edit', 'print', 'archive', 'restore', 'permanent_delete']);
  });
  it('System Administrator authority is backend-derived: no stored role rows exist for the admin', async () => {
    const rows = await db.query('SELECT count(*)::int AS n FROM role_permissions');
    expect(rows.rows[0].n).toBe(0);
    expect((await admin.call('POST', `/api/workspaces/${ws.key}/tabs/MAIN/records`, { values: { name_main: 'x' } })).status).toBe(201);
  });
});

describe.skipIf(!URL_)('Add is tab-specific; lifecycle; permissions', () => {
  it('creates records on exactly the tab used, and rejects another tab\'s fields', async () => {
    const g2 = await admin.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_2/records`, { values: { name_grid_2: 'grid two' } });
    expect(g2.status).toBe(201); expect(g2.data.tabKey).toBe('GRID_2');
    expect((await admin.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_2/records`, { values: { name_main: 'wrong tab field' } })).status).toBe(422);
    expect((await admin.call('GET', `/api/workspaces/${ws.key}/tabs/MAIN/records`)).data.items.every((r: any) => r.tabKey === 'MAIN')).toBe(true);
    expect((await admin.call('GET', `/api/workspaces/${ws.key}/tabs/GRID_1/records`)).data.items).toHaveLength(0);
  });
  it('validates required fields and types', async () => {
    expect((await admin.call('POST', `/api/workspaces/${ws.key}/tabs/MAIN/records`, { values: {} })).error.code).toBe('FIELD_REQUIRED');
    expect((await admin.call('POST', `/api/workspaces/${ws.key}/tabs/MAIN/records`, { values: { name_main: 'ok', amount: 'abc' } })).error.code).toBe('FIELD_INVALID');
  });
  it('runs the full lifecycle on one record: edit → archive → restore (same id) → archive → permanent delete', async () => {
    const created = (await admin.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_1/records`, { values: { name_grid_1: 'life' } })).data;
    const base = `/api/workspaces/${ws.key}/tabs/GRID_1/records/${created.id}`;
    const edited = (await admin.call('PATCH', base, { version: created.version, values: { name_grid_1: 'life 2' } })).data;
    expect(edited.version).toBe(created.version + 1);
    expect((await admin.call('PATCH', base, { version: created.version, values: { name_grid_1: 'stale' } })).error.code).toBe('RECORD_VERSION_CONFLICT');
    // an Active record can be neither restored nor permanently deleted
    expect((await admin.call('POST', base + '/restore', { version: edited.version })).status).toBe(404);
    expect((await admin.call('DELETE', base, { version: edited.version, confirmation: 'DELETE' })).status).toBe(404);
    const archived = (await admin.call('POST', base + '/archive', { version: edited.version })).data;
    expect(archived.state).toBe('Archived');
    // an Archived record cannot be edited or archived again
    expect((await admin.call('PATCH', base, { version: archived.version, values: { name_grid_1: 'no' } })).status).toBe(404);
    const restored = (await admin.call('POST', base + '/restore', { version: archived.version })).data;
    expect(restored.id).toBe(created.id); expect(restored.state).toBe('Active');
    const again = (await admin.call('POST', base + '/archive', { version: restored.version })).data;
    expect((await admin.call('DELETE', base, { version: again.version, confirmation: 'DELETE' })).status).toBe(200);
    expect((await db.query('SELECT 1 FROM records WHERE id=$1', [created.id])).rowCount).toBe(0);
    expect((await db.query("SELECT count(*)::int n FROM audit_events WHERE entity_id=$1 AND action LIKE 'RECORD_%'", [created.id])).rows[0].n).toBe(6);
  });
  it('enforces tab permissions, Dashboard independence, lifecycle specials and the Workspace Administrator limits', async () => {
    await grant('grid1user', ['GRID_1|VIEW', 'GRID_1|ADD', 'GRID_1|EDIT', 'GRID_1|DELETE']);
    const u = await client('grid1user');
    // Dashboard VIEW = false, GRID_1 VIEW = true → Grid 1 works, Dashboard does not
    expect((await u.call('GET', `/api/workspaces/${ws.key}/dashboard`)).status).toBe(403);
    expect((await u.call('GET', `/api/workspaces/${ws.key}/runtime`)).data.dashboard.visible).toBe(false);
    expect((await u.call('GET', '/api/workspaces')).data.map((w: any) => w.key)).toContain(ws.key);
    const mine = (await u.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_1/records`, { values: { name_grid_1: 'mine' } })).data;
    expect((await u.call('GET', `/api/workspaces/${ws.key}/tabs/GRID_1/records`)).data.items.map((r: any) => r.id)).toEqual([mine.id]);
    // other tabs are denied
    expect((await u.call('GET', `/api/workspaces/${ws.key}/tabs/GRID_2/records`)).status).toBe(403);
    expect((await u.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_2/records`, { values: { name_grid_2: 'x' } })).status).toBe(403);
    // runtime exposes only the permitted actions; no Print/Restore/Permanent Delete
    const tab = (await u.call('GET', `/api/workspaces/${ws.key}/runtime`)).data.tabs.find((t: any) => t.key === 'GRID_1');
    expect(tab.actions.map((a: any) => a.operation)).toEqual(['view', 'add', 'edit', 'archive']);
    // archive works (DELETE) but restore / permanent delete are denied without the specials
    const archived = (await u.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_1/records/${mine.id}/archive`, { version: mine.version })).data;
    expect((await u.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_1/records/${mine.id}/restore`, { version: archived.version })).status).toBe(403);
    expect((await u.call('DELETE', `/api/workspaces/${ws.key}/tabs/GRID_1/records/${mine.id}`, { version: archived.version, confirmation: 'DELETE' })).status).toBe(403);
    // Workspace Administrator widens normal tab permissions but never restore / permanent delete
    await grant('wsadmin', ['SPECIAL|WORKSPACE_ADMINISTRATOR', 'DASHBOARD|VIEW']);
    const w = await client('wsadmin');
    const rec = (await w.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_3/records`, { values: { name_grid_3: 'wa' } })).data;
    expect(rec.tabKey).toBe('GRID_3');
    const warch = (await w.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_3/records/${rec.id}/archive`, { version: rec.version })).data;
    expect((await w.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_3/records/${rec.id}/restore`, { version: warch.version })).status).toBe(403);
    expect((await w.call('DELETE', `/api/workspaces/${ws.key}/tabs/GRID_3/records/${rec.id}`, { version: warch.version, confirmation: 'DELETE' })).status).toBe(403);
    // an explicit lifecycle role grants restore (needs VIEW + VIEW_ARCHIVED + RESTORE, not EDIT) and permanent delete (DELETE + PERMANENT_DELETE)
    await grant('restorer', ['GRID_3|VIEW', 'SPECIAL|VIEW_ARCHIVED_RECORDS', 'SPECIAL|RESTORE_ARCHIVED_RECORDS', 'SPECIAL|VIEW_RECORDS_OWNED_BY_OTHERS']);
    const r = await client('restorer');
    expect((await r.call('POST', `/api/workspaces/${ws.key}/tabs/GRID_3/records/${rec.id}/restore`, { version: warch.version })).data.state).toBe('Active');
  });
  it('System Administrator still obeys lifecycle and integrity (references block permanent delete)', async () => {
    const target = (await admin.call('POST', `/api/workspaces/${ws.key}/tabs/MAIN/records`, { values: { name_main: 'target' } })).data;
    const w2 = await admin.call('POST', '/api/admin/workspaces', { key: 'ref-workspace', name: 'Ref', pluralName: 'Refs' });
    const sec = (await admin.call('POST', `/api/admin/workspaces/${w2.data.id}/sections`, { tabKey: 'MAIN', name: 'S' })).data.id;
    await admin.call('POST', `/api/admin/workspaces/${w2.data.id}/fields`, { sectionId: sec, key: 'title', label: 'Title', type: 'text' });
    expect((await admin.call('POST', `/api/admin/workspaces/${w2.data.id}/fields`, { sectionId: sec, key: 'link', label: 'Link', type: 'reference', referenceWorkspaceId: ws.id })).status).toBe(201);
    expect((await admin.call('POST', '/api/workspaces/ref-workspace/tabs/MAIN/records', { values: { link: '11111111-1111-1111-1111-111111111111' } })).error.code).toBe('FIELD_INVALID');
    const source = await admin.call('POST', '/api/workspaces/ref-workspace/tabs/MAIN/records', { values: { link: target.id } });
    expect(source.status).toBe(201);
    const listed = (await admin.call('GET', '/api/workspaces/ref-workspace/tabs/MAIN/records')).data;
    expect(listed.references[target.id]).toBe('target');
    const archived = (await admin.call('POST', `/api/workspaces/${ws.key}/tabs/MAIN/records/${target.id}/archive`, { version: target.version })).data;
    const blocked = await admin.call('DELETE', `/api/workspaces/${ws.key}/tabs/MAIN/records/${target.id}`, { version: archived.version, confirmation: 'DELETE' });
    expect(blocked.status).toBe(409); expect(blocked.error.code).toBe('RECORD_REFERENCED');
  });
});

describe.skipIf(!URL_)('Dashboard (Metric + Table) respects source permissions', () => {
  it('computes configured components and hides data from users lacking the source tab VIEW', async () => {
    await admin.call('POST', `/api/admin/workspaces/${ws.id}/components`, { type: 'metric', title: 'Main records', config: { sourceTab: 'MAIN', aggregation: 'count' } });
    await admin.call('POST', `/api/admin/workspaces/${ws.id}/components`, { type: 'table', title: 'Grid 2 rows', config: { sourceTab: 'GRID_2', fieldKeys: ['name_grid_2'] } });
    const full = (await admin.call('GET', `/api/workspaces/${ws.key}/dashboard`)).data;
    expect(full.find((c: any) => c.type === 'metric').status).toBe('ok');
    expect(full.find((c: any) => c.type === 'table').rows.length).toBeGreaterThan(0);
    await grant('dashonly', ['DASHBOARD|VIEW', 'MAIN|VIEW', 'SPECIAL|VIEW_RECORDS_OWNED_BY_OTHERS']);
    const d = (await (await client('dashonly')).call('GET', `/api/workspaces/${ws.key}/dashboard`)).data;
    expect(d.find((c: any) => c.type === 'metric').status).toBe('ok');
    expect(d.find((c: any) => c.type === 'table').status).toBe('forbidden'); // no GRID_2 VIEW → source data stays protected
  });
});

describe.skipIf(!URL_)('Workspace Manager and platform rules', () => {
  it('assigns a Form to a Grid tab and rejects fields from another tab', async () => {
    const form = await admin.call('POST', `/api/admin/workspaces/${ws.id}/forms`, { name: 'Grid 2 form', layout: { sections: [{ title: 'Details', fieldKeys: ['name_grid_2'] }] } });
    expect((await admin.call('PATCH', `/api/admin/workspaces/${ws.id}/tabs/GRID_2`, { formId: form.data.id })).status).toBe(200);
    const bad = await admin.call('POST', `/api/admin/workspaces/${ws.id}/forms`, { name: 'Wrong', layout: { sections: [{ title: 'X', fieldKeys: ['name_main'] }] } });
    expect((await admin.call('PATCH', `/api/admin/workspaces/${ws.id}/tabs/GRID_1`, { formId: bad.data.id })).status).toBe(400);
    const runtime = (await admin.call('GET', `/api/workspaces/${ws.key}/runtime`)).data;
    expect(runtime.tabs.find((t: any) => t.key === 'GRID_2').form.name).toBe('Grid 2 form');
    expect(runtime.tabs.find((t: any) => t.key === 'GRID_1').form).toBeNull();
  });
  it('workspace configuration endpoints are System Administrator only', async () => {
    const u = await client('grid1user');
    expect((await u.call('POST', '/api/admin/workspaces', { key: 'nope-ws', name: 'No', pluralName: 'Nos' })).status).toBe(403);
    expect((await u.call('GET', '/api/admin/access')).status).toBe(403);
  });
  it('requires a session and a CSRF token', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/workspaces' })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { schoolSlug: 'test-school', username: 'sysadmin', password: PASSWORD } });
    const res = await app.inject({ method: 'POST', url: '/api/admin/workspaces', payload: { key: 'csrf-ws', name: 'C', pluralName: 'Cs' }, headers: { cookie: String(login.headers['set-cookie']).split(';')[0]! } });
    expect(res.statusCode).toBe(403);
  });
});
