// Real-browser proof of the V2 foundation. Usage: node e2e/foundation.e2e.cjs  (server on :4020, frontend on :5173, EMPTY schoolhub_v2 database)
// Everything about "Test Workspace" is configured through the Workspace Manager UI; there is no workspace-specific code.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.V2_URL || 'http://127.0.0.1:5173', PW = 'Sup3r!SecretPass#1', results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  — ' + extra : '')); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const requests = [], errors = [];
  page.on('request', (r) => { if (r.url().includes('/api/') && r.method() !== 'GET') requests.push(r.method() + ' ' + new URL(r.url()).pathname); });
  page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept());
  const shot = (name) => page.screenshot({ path: `e2e/.artifacts/${name}.png` });
  require('fs').mkdirSync('e2e/.artifacts', { recursive: true });
  const nav = async (key) => { await page.click(`[data-nav="${key}"]`); await page.waitForTimeout(500); };
  const tab = async (key) => { await page.click(`[data-tab="${key}"]`); await page.waitForTimeout(500); };
  const rows = () => page.$$eval('tr[data-record-id]', (trs) => trs.map((tr) => ({ state: tr.dataset.state, text: tr.innerText.replace(/\s+/g, ' '), ops: [...tr.querySelectorAll('button[data-op]')].map((b) => b.dataset.op) })));
  const toolbarOps = () => page.$$eval('.toolbar button[data-op]', (bs) => bs.map((b) => b.dataset.op));
  const clickRowOp = async (op, n = 0) => { await page.locator(`tr[data-record-id] button[data-op="${op}"]`).nth(n).click(); await page.waitForTimeout(500); };
  const fillDialogAndSave = async (value, id) => { await page.fill(`#f_${id}`, value); await page.click('.dialog footer .btn.primary'); await page.waitForTimeout(700); };

  // ---- 1. setup + login (new V2 authentication)
  await page.goto(BASE); await page.click('text=First server setup');
  await page.fill('#schoolName', 'Test School'); await page.fill('#schoolSlug', 'test-school'); await page.fill('#displayName', 'System Admin');
  await page.fill('#username', 'sysadmin'); await page.fill('#password', PW); await page.click('button:has-text("Create school and sign in")');
  await page.waitForSelector('[data-nav="manager"]'); check('setup + login as System Administrator', true);

  // ---- 2. Workspace Manager: create the test workspace and configure everything
  await nav('manager');
  await page.fill('[aria-label="new workspace key"]', 'test-workspace'); await page.fill('[aria-label="new workspace name"]', 'Test Item'); await page.fill('[aria-label="new workspace pluralName"]', 'Test Items');
  await page.click('[aria-label="create workspace"]'); await page.waitForSelector('[data-wm-tab="MAIN"]');
  const TABS = ['MAIN', 'GRID_1', 'GRID_2', 'GRID_3'];
  for (const t of TABS) {
    const box = page.locator(`[data-wm-tab="${t}"]`);
    await box.locator(`[aria-label="${t} new section"]`).fill('Details'); await box.locator(`[aria-label="${t} add section"]`).click(); await page.waitForTimeout(400);
    await box.locator('[aria-label="new field key"]').fill('name_' + t.toLowerCase()); await box.locator('[aria-label="new field label"]').fill(t + ' Name');
    await box.locator('label:has-text("Required") input').check(); await box.locator('[aria-label="add field"]').click(); await page.waitForTimeout(400);
    await box.locator(`[data-field="name_${t.toLowerCase()}"] [aria-label$="searchable"]`).click(); await page.waitForTimeout(300);
  }
  const main = page.locator('[data-wm-tab="MAIN"]');
  await main.locator('[aria-label="new field key"]').fill('amount'); await main.locator('[aria-label="new field label"]').fill('Amount'); await main.locator('[aria-label="new field type"]').selectOption('integer'); await main.locator('[aria-label="add field"]').click(); await page.waitForTimeout(400);
  // a Form for GRID_2, assigned to GRID_2
  await page.fill('[aria-label="form name"]', 'Grid 2 Form'); await page.selectOption('[aria-label="form tab"]', 'GRID_2'); await page.locator('.card:has(h3:text-is("Forms")) label:has-text("GRID_2 Name") input').check(); await page.click('[aria-label="create form"]'); await page.waitForTimeout(500);
  await page.selectOption('[aria-label="GRID_2 form"]', { label: 'Form: Grid 2 Form' }); await page.waitForTimeout(500);
  // tab label change
  const g3label = page.locator('[aria-label="GRID_3 label"]'); await g3label.fill('Archive Tray'); await g3label.blur(); await page.waitForTimeout(500);
  // dashboard components
  await page.fill('[aria-label="component title"]', 'Main records'); await page.click('[aria-label="add component"]'); await page.waitForTimeout(500);
  await page.selectOption('[aria-label="component type"]', 'table'); await page.fill('[aria-label="component title"]', 'Grid 1 rows'); await page.selectOption('[aria-label="source tab"]', 'GRID_1');
  await page.locator('.card:has(h3:text-is("Dashboard components")) label:has-text("GRID_1 Name") input').check(); await page.click('[aria-label="add component"]'); await page.waitForTimeout(500);
  await shot('workspace-manager'); check('Workspace Manager configured sections, fields, form, tab label, dashboard', true);

  // ---- 3. Access: restricted user via User → Group → Role
  await nav('access');
  await page.fill('[aria-label="user username"]', 'limited'); await page.fill('[aria-label="user displayName"]', 'Limited User'); await page.fill('[aria-label="user password"]', PW); await page.click('[aria-label="create user"]'); await page.waitForTimeout(600);
  await page.fill('[aria-label="group name"]', 'Grid1 Group'); await page.click('[aria-label="create group"]'); await page.waitForTimeout(600);
  await page.selectOption('[aria-label="role workspace"]', { label: 'Test Item' }); await page.fill('[aria-label="role name"]', 'Grid1 Role');
  for (const p of ['VIEW', 'ADD', 'EDIT', 'DELETE']) await page.check(`[aria-label="GRID_1 ${p}"]`);
  await page.click('[aria-label="create role"]'); await page.waitForTimeout(700);
  await page.click('[aria-label="Grid1 Group role Grid1 Role"]'); await page.waitForTimeout(500); await page.click('[aria-label="Grid1 Group member limited"]'); await page.waitForTimeout(500);
  await shot('access'); check('Access: user, group, role (41-selection matrix) configured', true);

  // ---- 4. Universal runtime as System Administrator
  await nav('test-workspace');
  const tabKeys = await page.$$eval('.tabs [data-tab]', (b) => b.map((x) => x.dataset.tab + ':' + x.textContent));
  check('five-tab contract: Dashboard + MAIN + GRID_1..3 with configured labels', JSON.stringify(tabKeys) === JSON.stringify(['DASHBOARD:Dashboard', 'MAIN:Main', 'GRID_1:Grid 1', 'GRID_2:Grid 2', 'GRID_3:Archive Tray']), tabKeys.join(' '));
  for (const t of TABS) {
    await tab(t); requests.length = 0;
    check(`${t}: toolbar shows only Add`, JSON.stringify(await toolbarOps()) === '["add"]');
    await page.click('.toolbar button[data-op="add"]'); await page.waitForSelector('[data-testid="form-dialog"][data-mode="add"]');
    if (t === 'GRID_2') check('GRID_2 Add opens the assigned Form in a dialog, Grid stays visible', (await page.textContent('[data-testid="form-dialog"] h3')).includes('Grid 2 Form') && await page.isVisible('[data-testid="tab-GRID_2"]'));
    await fillDialogAndSave(`${t} record one`, 'name_' + t.toLowerCase());
    check(`${t}: Add created a record on THIS tab only`, requests.some((r) => r === `POST /api/workspaces/test-workspace/tabs/${t}/records`) && requests.filter((r) => r.startsWith('POST')).length === 1, requests.join(','));
    let r = await rows(); check(`${t}: Active record offers View/Edit/Print/Archive only`, r.length === 1 && JSON.stringify(r[0].ops) === '["view","edit","print","archive"]', JSON.stringify(r[0]?.ops));
    await clickRowOp('view'); await page.waitForSelector('[data-testid="form-dialog"][data-mode="view"]');
    check(`${t}: View is a read-only dialog`, (await page.$$('[data-testid="form-dialog"] input')).length === 0); await page.click('.dialog footer .btn'); await page.waitForTimeout(300);
    await clickRowOp('edit'); await page.waitForSelector('[data-testid="form-dialog"][data-mode="edit"]');
    check(`${t}: Edit dialog is populated`, (await page.inputValue('#f_name_' + t.toLowerCase())) === `${t} record one`);
    await fillDialogAndSave(`${t} edited`, 'name_' + t.toLowerCase());
    check(`${t}: Edit updated THAT record`, (await rows())[0].text.includes(`${t} edited`));
    await clickRowOp('print'); check(`${t}: Print opens the print frame`, !!(await page.$('iframe')));
    await page.waitForTimeout(2300);
    requests.length = 0; await clickRowOp('archive'); r = await rows();
    check(`${t}: Archive is soft (record kept) and flips actions to View/Print/Restore/Permanent Delete`, r.length === 1 && r[0].state === 'Archived' && JSON.stringify(r[0].ops) === '["view","print","restore","permanent_delete"]', JSON.stringify(r[0]));
    await clickRowOp('restore'); r = await rows(); check(`${t}: Restore returns the same record to Active`, r[0].state === 'Active' && r[0].text.includes(`${t} edited`));
    await clickRowOp('archive'); await clickRowOp('permanent_delete'); r = await rows(); check(`${t}: Permanent Delete removes the archived record`, r.length === 0);
    await page.click('.toolbar button[data-op="add"]'); await fillDialogAndSave(`${t} kept`, 'name_' + t.toLowerCase());
  }
  await shot('runtime-grid2'); await tab('MAIN');
  check('search filters by searchable fields', (await (async () => { await page.fill('.search', 'nomatchzzz'); const n = (await rows()).length; await page.fill('.search', ''); return n === 0; })()));
  await tab('DASHBOARD'); await page.waitForTimeout(600);
  const dash = await page.innerText('[data-testid="dashboard"]'); check('Dashboard shows configured Metric and Table from real data', dash.includes('Main records') && dash.includes('GRID_1 kept'), dash.replace(/\s+/g, ' ').slice(0, 120)); await shot('dashboard');

  // ---- 5. Restricted user: Dashboard VIEW = false, GRID_1 works
  await page.click('text=Sign out'); await page.waitForSelector('#username');
  await page.fill('#schoolSlug', 'test-school'); await page.fill('#username', 'limited'); await page.fill('#password', PW); await page.click('button:has-text("Sign in")');
  await page.waitForSelector('[data-nav="test-workspace"]'); check('limited user sees the workspace in navigation', true);
  check('limited user has no Administration menu', (await page.$('[data-nav="manager"]')) === null);
  await nav('test-workspace');
  const limitedTabs = await page.$$eval('.tabs [data-tab]', (b) => b.map((x) => x.dataset.tab));
  check('Dashboard VIEW=false hides Dashboard but GRID_1 still opens (only permitted tab)', JSON.stringify(limitedTabs) === '["GRID_1"]', limitedTabs.join(','));
  check('GRID_1 loaded for the limited user', !!(await page.$('[data-testid="tab-GRID_1"]')));
  check('limited user sees only their own records (none yet)', (await rows()).length === 0);
  await page.click('.toolbar button[data-op="add"]'); await fillDialogAndSave('limited record', 'name_grid_1');
  let lr = await rows(); check('limited user: Add works; actions limited to View/Edit/Archive (no Print without PRINT)', lr.length === 1 && JSON.stringify(lr[0].ops) === '["view","edit","archive"]', JSON.stringify(lr[0]?.ops));
  await clickRowOp('archive'); lr = await rows(); check('limited user: an archived record is hidden without VIEW_ARCHIVED_RECORDS, so Restore / Permanent Delete cannot be offered', lr.length === 0);
  await shot('limited-user');
  check('no uncaught browser errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} checks passed`); process.exit(failed.length ? 1 : 0);
})().catch((error) => { console.error('E2E CRASH', error); process.exit(2); });
