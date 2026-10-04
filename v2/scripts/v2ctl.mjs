#!/usr/bin/env node
// SchoolHub V2 control script (Windows / macOS / Linux). Operates ONLY on the v2/ application and ONLY on the V2 database.
// Usage: node scripts/v2ctl.mjs setup | start | stop | status
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, openSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // …/v2
const RUN = path.join(ROOT, '.run'), CONFIG_FILE = path.join(ROOT, 'v2.config.env'), WINDOWS = process.platform === 'win32';
const APPROVED = ['schoolhub_v2', 'schoolhub_v2_test'];
const say = (text = '') => console.log(text), fail = (text) => { console.error(`\nERROR: ${text}\n`); process.exit(1); };

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) fail(`v2.config.env was not found.\nCopy v2.config.env.example to v2.config.env (inside the v2 folder), set POSTGRES_USER and POSTGRES_PASSWORD, then run this again.`);
  const values = {};
  for (const raw of readFileSync(CONFIG_FILE, 'utf8').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line); if (!match) fail(`Invalid line in v2.config.env: ${line}`);
    values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  const config = { POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: '5432', POSTGRES_DATABASE: 'schoolhub_v2', POSTGRES_TEST_DATABASE: 'schoolhub_v2_test', SERVER_HOST: '127.0.0.1', SERVER_PORT: '4120', FRONTEND_HOST: '127.0.0.1', FRONTEND_PORT: '5180', ...values };
  for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD']) if (!config[key] || /^(CHANGE_ME|replace_me)$/i.test(config[key])) fail(`Set ${key} in v2.config.env (it still has the placeholder value).`);
  // Safety guard #1 (the server enforces the same list again and refuses to start otherwise).
  if (!APPROVED.includes(config.POSTGRES_DATABASE)) fail(`POSTGRES_DATABASE is "${config.POSTGRES_DATABASE}". V2 may only use: ${APPROVED.join(', ')}.\nThis protects your old SchoolHub database; it cannot be overridden.`);
  if (config.POSTGRES_TEST_DATABASE && config.POSTGRES_TEST_DATABASE !== 'schoolhub_v2_test') fail('POSTGRES_TEST_DATABASE must be empty or schoolhub_v2_test.');
  for (const key of ['SERVER_PORT', 'FRONTEND_PORT', 'POSTGRES_PORT']) if (!/^\d+$/.test(config[key]) || +config[key] < 1 || +config[key] > 65535) fail(`${key} must be a port number.`);
  if (config.SERVER_PORT === config.FRONTEND_PORT) fail('SERVER_PORT and FRONTEND_PORT must be different.');
  if (['4010', '8080'].includes(config.SERVER_PORT) || ['4010', '8080'].includes(config.FRONTEND_PORT)) fail('Ports 4010 and 8080 belong to the old SchoolHub application. Choose other V2 ports.');
  return config;
}
const serverEnv = (c, database = c.POSTGRES_DATABASE) => ({
  ...process.env, NODE_ENV: 'production', HOST: c.SERVER_HOST, PORT: c.SERVER_PORT, POSTGRES_HOST: c.POSTGRES_HOST, POSTGRES_PORT: c.POSTGRES_PORT,
  POSTGRES_DATABASE: database, POSTGRES_USER: c.POSTGRES_USER, POSTGRES_PASSWORD: c.POSTGRES_PASSWORD, ALLOWED_ORIGIN: `http://${c.FRONTEND_HOST}:${c.FRONTEND_PORT}`,
  DATABASE_URL: '',   // never inherited from the environment: the old app's settings must not leak in
});
const apiUrl = (c) => `http://${c.SERVER_HOST}:${c.SERVER_PORT}`, webUrl = (c) => `http://${c.FRONTEND_HOST}:${c.FRONTEND_PORT}`;

function run(title, command, args, options = {}) {
  say(`\n> ${title}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: WINDOWS, ...options });
  if (result.status !== 0) fail(`${title} failed. Fix the problem shown above and run again.`);
}
const npm = WINDOWS ? 'npm.cmd' : 'npm';

function checkTools() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) fail(`Node.js 22 or newer is required (found ${process.versions.node}). Install it from https://nodejs.org and run again.`);
  const check = spawnSync(npm, ['--version'], { shell: WINDOWS, encoding: 'utf8' });
  if (check.status !== 0) fail('npm was not found. Install Node.js (it includes npm) from https://nodejs.org.');
  say(`Node ${process.versions.node}, npm ${check.stdout.trim()} — OK`);
}

const pidFile = (name) => path.join(RUN, `${name}.pid`);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const readPid = (name) => { try { const pid = Number(readFileSync(pidFile(name), 'utf8')); return pid && alive(pid) ? pid : 0; } catch { return 0; } };
const get = (url) => new Promise((resolve) => { const request = http.get(url, (res) => { res.resume(); resolve(res.statusCode); }); request.on('error', () => resolve(0)); request.setTimeout(2000, () => { request.destroy(); resolve(0); }); });
async function waitFor(url, seconds = 40) { for (let i = 0; i < seconds; i++) { if ((await get(url)) === 200) return true; await new Promise((r) => setTimeout(r, 1000)); } return false; }

function spawnService(name, command, args, env, cwd = ROOT) {
  mkdirSync(RUN, { recursive: true });
  const log = openSync(path.join(RUN, `${name}.log`), 'a');
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', log, log], windowsHide: true });
  child.unref(); writeFileSync(pidFile(name), String(child.pid));
}
function killTree(pid) {
  if (WINDOWS) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ } } }
}

async function start() {
  const c = loadConfig();
  for (const name of ['backend', 'frontend']) if (readPid(name)) fail(`V2 ${name} is already running. Run Stop-SchoolHub-V2.bat first.`);
  if (!existsSync(path.join(ROOT, 'server/dist/server/src/main.js')) || !existsSync(path.join(ROOT, 'frontend/dist/index.html'))) fail('V2 has not been built yet. Run Setup-SchoolHub-V2.bat first.');
  spawnService('backend', process.execPath, ['server/dist/server/src/main.js'], serverEnv(c));
  if (!(await waitFor(`${apiUrl(c)}/api/health`))) { killTree(readPid('backend')); fail(`The V2 backend did not start. See ${path.join(RUN, 'backend.log')}`); }
  spawnService('frontend', process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview'],
    { ...process.env, V2_FRONTEND_HOST: c.FRONTEND_HOST, V2_FRONTEND_PORT: c.FRONTEND_PORT, V2_API_URL: apiUrl(c) }, path.join(ROOT, 'frontend'));
  if (!(await waitFor(webUrl(c) + '/'))) { killTree(readPid('frontend')); killTree(readPid('backend')); fail(`The V2 frontend did not start. See ${path.join(RUN, 'frontend.log')}`); }
  say('\nSchoolHub V2 is running.\n');
  say(`  Frontend (open this in Chrome): ${webUrl(c)}`); say(`  Backend:                       ${apiUrl(c)}`); say(`  Database:                      ${c.POSTGRES_DATABASE}`);
  say(`\nFirst time? Click "First server setup" to create your school and System Administrator.`); say('To stop V2 run Stop-SchoolHub-V2.bat.');
  if (process.argv.includes('--open')) { if (WINDOWS) spawn('cmd', ['/c', 'start', '', webUrl(c)], { detached: true, stdio: 'ignore' }).unref(); }
}

function stop() {
  let any = false;
  for (const name of ['frontend', 'backend']) {
    const pid = readPid(name);
    if (pid) { killTree(pid); say(`Stopped V2 ${name} (process ${pid}).`); any = true; }
    rmSync(pidFile(name), { force: true });
  }
  say(any ? 'SchoolHub V2 stopped. (The old SchoolHub application was not touched.)' : 'SchoolHub V2 was not running.');
}

async function status() {
  const c = loadConfig();
  const be = readPid('backend'), fe = readPid('frontend');
  say('SchoolHub V2 status');
  say(`  Database setting : ${c.POSTGRES_DATABASE} on ${c.POSTGRES_HOST}:${c.POSTGRES_PORT}`);
  say(`  Backend          : ${be ? `running (process ${be})` : 'stopped'}   ${apiUrl(c)}   health: ${(await get(apiUrl(c) + '/api/health')) === 200 ? 'OK' : 'no answer'}`);
  say(`  Frontend         : ${fe ? `running (process ${fe})` : 'stopped'}   ${webUrl(c)}   page: ${(await get(webUrl(c) + '/')) === 200 ? 'OK' : 'no answer'}`);
  say(`  Logs             : ${RUN}`);
}

async function setup() {
  const c = loadConfig();
  say('SchoolHub V2 setup — works ONLY on the V2 database "' + c.POSTGRES_DATABASE + '".');
  checkTools();
  run('Installing V2 dependencies', npm, ['install', '--no-audit', '--no-fund']);
  run('Checking PostgreSQL and the V2 database (read-only check)', npm, ['exec', '-w', 'server', '--', 'tsx', 'src/db/check-cli.ts'], { env: serverEnv(c) });
  run('Building V2 backend', npm, ['run', 'build', '-w', 'server']);
  run('Building V2 frontend', npm, ['run', 'build', '-w', 'frontend']);
  run('Applying V2 database migrations (001 and later; V2 only)', process.execPath, ['server/dist/server/src/db/migrate-cli.js'], { env: serverEnv(c), shell: false });
  say('\n> Running V2 tests');
  run('Frontend and configuration-guard tests', npm, ['run', 'test', '-w', 'frontend']);
  run('Backend safety-guard tests', npm, ['exec', '-w', 'server', '--', 'vitest', 'run', 'tests/config.test.ts']);
  if (c.POSTGRES_TEST_DATABASE) {
    const probe = spawnSync(npm, ['exec', '-w', 'server', '--', 'tsx', 'src/db/check-cli.ts'], { cwd: ROOT, env: serverEnv(c, c.POSTGRES_TEST_DATABASE), shell: WINDOWS, encoding: 'utf8' });
    if (probe.status === 0) run('Backend integration tests on schoolhub_v2_test (this test database is wiped and rebuilt)', npm, ['exec', '-w', 'server', '--', 'vitest', 'run', '--maxWorkers=1', '--fileParallelism=false'],
      { env: { ...serverEnv(c, c.POSTGRES_TEST_DATABASE), TEST_DATABASE_URL: `postgresql://${encodeURIComponent(c.POSTGRES_USER)}:${encodeURIComponent(c.POSTGRES_PASSWORD)}@${c.POSTGRES_HOST}:${c.POSTGRES_PORT}/${c.POSTGRES_TEST_DATABASE}` } });
    else say('\n(Backend integration tests skipped: the optional database "schoolhub_v2_test" does not exist. They are not needed for manual testing.)');
  }
  say('\nSetup complete. Starting V2…');
  await start();
}

const command = process.argv[2];
const commands = { setup, start, stop, status };
if (!commands[command]) fail('Usage: node scripts/v2ctl.mjs setup | start | stop | status');
await commands[command]();
