import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { z } from 'zod';
import { OPERATIONAL_TAB_KEYS, STANDARD_OPERATIONS, FIELD_TYPES, ROLE_TAB_KEYS, allSelections, PERMISSION_COUNT } from '../../../shared/src/index.js';
import type { Config } from '../config.js';
import type { Database } from '../db/database.js';
import { AuthService, type Principal } from '../auth/auth-service.js';
import { WorkspaceManager } from '../workspaces/manager.js';
import { loadDefinition } from '../workspaces/definition.js';
import { navigation, runtimeDefinition } from '../workspaces/runtime.js';
import { RecordService } from '../records/record-service.js';
import { DashboardService } from '../dashboard/dashboard-service.js';
import { AccessService } from '../access/access-service.js';
import { AppError, badRequest, forbidden, unauthenticated } from './errors.js';

declare module 'fastify' { interface FastifyRequest { principal?: Principal; csrfToken?: string } }

const tab = z.enum(OPERATIONAL_TAB_KEYS);
const selection = z.object({ tabKey: z.enum(ROLE_TAB_KEYS), permissionKey: z.string().max(80) }).strict();
const layout = z.object({ sections: z.array(z.object({ title: z.string().max(120), fieldKeys: z.array(z.string().max(60)) })) }).strict();
const valuesBody = z.object({ values: z.record(z.string().max(60), z.unknown()) }).strict();
const versionBody = z.object({ version: z.number().int().positive() }).strict();

export async function buildApp(config: Config, db: Database): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.nodeEnv === 'development' ? { level: 'warn' } : false });
  await app.register(cookie);
  const auth = new AuthService(db, config.sessionHours), manager = new WorkspaceManager(db), records = new RecordService(db),
    dashboard = new DashboardService(db), access = new AccessService(db);

  app.setErrorHandler((error: any, _req, reply) => {
    if (error instanceof AppError) return reply.code(error.status).send({ error: { code: error.code, message: error.message, details: error.details } });
    if (error instanceof z.ZodError) return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Check the supplied values.', details: { issues: error.issues.map((i) => i.path.join('.') + ': ' + i.message) } } });
    if (error?.statusCode && error.statusCode < 500) return reply.code(error.statusCode).send({ error: { code: 'BAD_REQUEST', message: error.message } });
    app.log.error(error); return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
  });

  // Authentication + CSRF for every /api route except setup/login.
  const open = new Set(['/api/setup', '/api/auth/login', '/api/health']);
  app.addHook('preHandler', async (req: FastifyRequest) => {
    const path = req.url.split('?')[0]!;
    if (!path.startsWith('/api/') || open.has(path)) return;
    const result = await auth.authenticate(req.cookies[config.sessionCookie]);
    req.principal = result.principal; req.csrfToken = result.csrfToken;
    if (req.method !== 'GET' && req.headers['x-csrf-token'] !== result.csrfToken) throw new AppError(403, 'CSRF_INVALID', 'The request could not be verified. Reload and try again.');
  });
  const me = (req: FastifyRequest) => req.principal ?? (() => { throw unauthenticated(); })();
  /** Workspace Manager and Access Management are platform administration: System Administrator only. */
  const admin = (req: FastifyRequest) => { const p = me(req); if (!p.systemAdministrator) throw forbidden('System Administrator access is required.'); return p; };
  const param = (req: FastifyRequest, name: string) => String((req.params as Record<string, string>)[name]);

  app.get('/api/health', async () => ({ status: 'ok' }));
  app.post('/api/setup', async (req, reply) => {
    const body = z.object({ schoolName: z.string().min(2).max(160), schoolSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/), username: z.string().min(3).max(80), displayName: z.string().min(1).max(120), password: z.string().max(200) }).strict().parse(req.body);
    return reply.code(201).send({ data: await auth.setup(body) });
  });
  app.post('/api/auth/login', async (req, reply) => {
    const body = z.object({ schoolSlug: z.string().max(80), username: z.string().max(80), password: z.string().max(200) }).strict().parse(req.body);
    const { principal, session } = await auth.login(body.schoolSlug, body.username, body.password);
    reply.setCookie(config.sessionCookie, session.token, { httpOnly: true, sameSite: 'lax', path: '/', secure: config.nodeEnv === 'production', expires: session.expiresAt });
    return { data: { user: principal, csrfToken: session.csrfToken } };
  });
  app.post('/api/auth/logout', async (req, reply) => { await auth.logout(req.cookies[config.sessionCookie]); reply.clearCookie(config.sessionCookie, { path: '/' }); return { data: { ok: true } }; });
  app.get('/api/auth/me', async (req) => ({ data: { user: me(req), csrfToken: req.csrfToken } }));
  app.get('/api/permission-catalogue', async () => ({ data: { total: PERMISSION_COUNT, selections: allSelections(), operations: STANDARD_OPERATIONS, fieldTypes: FIELD_TYPES } }));

  // ---- Runtime (every user) ----
  app.get('/api/workspaces', async (req) => ({ data: await navigation(db, me(req)) }));
  app.get('/api/workspaces/:key/runtime', async (req) => ({ data: await runtimeDefinition(db, me(req), param(req, 'key')) }));
  app.get('/api/workspaces/:key/dashboard', async (req) => ({ data: await dashboard.get(me(req), param(req, 'key')) }));
  app.get('/api/workspaces/:key/reference-options/:fieldKey', async (req) => ({ data: await records.referenceOptions(me(req), param(req, 'key'), param(req, 'fieldKey'), String((req.query as any)?.q ?? '')) }));
  const base = '/api/workspaces/:key/tabs/:tab/records', t = (req: FastifyRequest) => tab.parse(param(req, 'tab'));
  app.get(base, async (req) => ({ data: await records.list(me(req), param(req, 'key'), t(req)) }));
  app.post(base, async (req, reply) => reply.code(201).send({ data: await records.create(me(req), param(req, 'key'), t(req), valuesBody.parse(req.body).values) }));
  app.patch(base + '/:id', async (req) => { const b = valuesBody.extend({ version: z.number().int().positive() }).parse(req.body); return { data: await records.update(me(req), param(req, 'key'), t(req), param(req, 'id'), b.version, b.values) }; });
  app.post(base + '/:id/archive', async (req) => ({ data: await records.archive(me(req), param(req, 'key'), t(req), param(req, 'id'), versionBody.parse(req.body).version) }));
  app.post(base + '/:id/restore', async (req) => ({ data: await records.restore(me(req), param(req, 'key'), t(req), param(req, 'id'), versionBody.parse(req.body).version) }));
  app.delete(base + '/:id', async (req) => { const b = versionBody.extend({ confirmation: z.literal('DELETE') }).parse(req.body); await records.permanentDelete(me(req), param(req, 'key'), t(req), param(req, 'id'), b.version); return { data: { deleted: true } }; });

  // ---- Workspace Manager (System Administrator) ----
  const wm = '/api/admin/workspaces';
  app.get(wm, async (req) => ({ data: await manager.list(admin(req)) }));
  app.post(wm, async (req, reply) => reply.code(201).send({ data: await manager.create(admin(req), z.object({ key: z.string(), name: z.string().min(2).max(120), pluralName: z.string().min(2).max(120), description: z.string().max(500).optional(), category: z.string().max(80).optional(), icon: z.string().max(40).optional() }).strict().parse(req.body)) }));
  app.get(wm + '/:id', async (req) => ({ data: await manager.get(admin(req), param(req, 'id')) }));
  app.patch(wm + '/:id', async (req) => ({ data: await manager.update(admin(req), param(req, 'id'), z.object({ name: z.string().min(2).max(120), pluralName: z.string().min(2).max(120), description: z.string().max(500), category: z.string().max(80), icon: z.string().max(40), status: z.enum(['Active', 'Archived']), displayFieldKey: z.string().nullable(), printTitle: z.string().max(160) }).partial().strict().parse(req.body)) }));
  app.patch(wm + '/:id/tabs/:tab', async (req) => ({ data: await manager.updateTab(admin(req), param(req, 'id'), t(req), z.object({ label: z.string().min(1).max(60), formId: z.string().uuid().nullable() }).partial().strict().parse(req.body)) }));
  app.post(wm + '/:id/sections', async (req, reply) => reply.code(201).send({ data: { id: await manager.createSection(admin(req), param(req, 'id'), z.object({ tabKey: tab, name: z.string().min(1).max(120), description: z.string().max(500).optional(), sortOrder: z.number().int().optional() }).strict().parse(req.body)) } }));
  app.patch(wm + '/:id/sections/:sectionId', async (req) => { await manager.updateSection(admin(req), param(req, 'id'), param(req, 'sectionId'), z.object({ name: z.string().min(1).max(120), description: z.string().max(500), sortOrder: z.number().int() }).partial().strict().parse(req.body)); return { data: { ok: true } }; });
  app.delete(wm + '/:id/sections/:sectionId', async (req) => { await manager.deleteSection(admin(req), param(req, 'id'), param(req, 'sectionId')); return { data: { ok: true } }; });
  const fieldShape = { label: z.string().min(1).max(120), required: z.boolean(), readOnly: z.boolean(), visible: z.boolean(), searchable: z.boolean(), filterable: z.boolean(), printVisible: z.boolean(), sortOrder: z.number().int(), helpText: z.string().max(500), defaultValue: z.unknown(), options: z.array(z.object({ value: z.string().min(1).max(120), label: z.string().min(1).max(120) })) };
  app.post(wm + '/:id/fields', async (req, reply) => reply.code(201).send({ data: { id: await manager.createField(admin(req), param(req, 'id'), z.object({ sectionId: z.string().uuid(), key: z.string(), type: z.enum(FIELD_TYPES), referenceWorkspaceId: z.string().uuid().nullable().optional(), ...fieldShape }).partial({ required: true, readOnly: true, visible: true, searchable: true, filterable: true, printVisible: true, sortOrder: true, helpText: true, defaultValue: true, options: true }).strict().parse(req.body) as any) } }));
  app.patch(wm + '/:id/fields/:fieldId', async (req) => { await manager.updateField(admin(req), param(req, 'id'), param(req, 'fieldId'), z.object({ ...fieldShape, sectionId: z.string().uuid() }).partial().strict().parse(req.body) as any); return { data: { ok: true } }; });
  app.delete(wm + '/:id/fields/:fieldId', async (req) => { await manager.deleteField(admin(req), param(req, 'id'), param(req, 'fieldId')); return { data: { ok: true } }; });
  app.post(wm + '/:id/forms', async (req, reply) => reply.code(201).send({ data: { id: await manager.createForm(admin(req), param(req, 'id'), z.object({ name: z.string().min(1).max(120), layout }).strict().parse(req.body)) } }));
  app.patch(wm + '/:id/forms/:formId', async (req) => { await manager.updateForm(admin(req), param(req, 'id'), param(req, 'formId'), z.object({ name: z.string().min(1).max(120), layout }).partial().strict().parse(req.body)); return { data: { ok: true } }; });
  app.delete(wm + '/:id/forms/:formId', async (req) => { await manager.deleteForm(admin(req), param(req, 'id'), param(req, 'formId')); return { data: { ok: true } }; });
  app.patch(wm + '/:id/actions/:tab/:operation', async (req) => { await manager.setAction(admin(req), param(req, 'id'), t(req), z.enum(STANDARD_OPERATIONS).parse(param(req, 'operation')), z.object({ enabled: z.boolean(), sortOrder: z.number().int() }).partial().strict().parse(req.body)); return { data: { ok: true } }; });
  const comp = z.object({ type: z.enum(['metric', 'table']), title: z.string().min(1).max(120), sortOrder: z.number().int().optional(), config: z.record(z.string(), z.unknown()) }).strict();
  app.post(wm + '/:id/components', async (req, reply) => reply.code(201).send({ data: { id: await manager.createComponent(admin(req), param(req, 'id'), comp.parse(req.body) as any) } }));
  app.patch(wm + '/:id/components/:componentId', async (req) => { await manager.updateComponent(admin(req), param(req, 'id'), param(req, 'componentId'), comp.pick({ title: true, sortOrder: true, config: true }).partial().parse(req.body) as any); return { data: { ok: true } }; });
  app.delete(wm + '/:id/components/:componentId', async (req) => { await manager.deleteComponent(admin(req), param(req, 'id'), param(req, 'componentId')); return { data: { ok: true } }; });

  // ---- Access management (System Administrator) ----
  app.get('/api/admin/access', async (req) => ({ data: await access.overview(admin(req)) }));
  app.post('/api/admin/users', async (req, reply) => reply.code(201).send({ data: { id: await access.createUser(admin(req), z.object({ username: z.string().min(3).max(80), displayName: z.string().min(1).max(120), password: z.string().max(200) }).strict().parse(req.body)) } }));
  app.post('/api/admin/groups', async (req, reply) => reply.code(201).send({ data: { id: await access.createGroup(admin(req), z.object({ name: z.string().min(2).max(120), description: z.string().max(500).optional() }).strict().parse(req.body)) } }));
  app.put('/api/admin/groups/:id/members', async (req) => { await access.setGroupMembers(admin(req), param(req, 'id'), z.object({ ids: z.array(z.string().uuid()) }).strict().parse(req.body).ids); return { data: { ok: true } }; });
  app.put('/api/admin/groups/:id/roles', async (req) => { await access.setGroupRoles(admin(req), param(req, 'id'), z.object({ ids: z.array(z.string().uuid()) }).strict().parse(req.body).ids); return { data: { ok: true } }; });
  app.post('/api/admin/roles', async (req, reply) => reply.code(201).send({ data: { id: await access.createRole(admin(req), z.object({ workspaceId: z.string().uuid(), name: z.string().min(2).max(120), description: z.string().max(500).optional(), selections: z.array(selection) }).strict().parse(req.body)) } }));
  app.put('/api/admin/roles/:id/permissions', async (req) => { await access.setRoleSelections(admin(req), param(req, 'id'), z.object({ selections: z.array(selection) }).strict().parse(req.body).selections); return { data: { ok: true } }; });
  void badRequest; void loadDefinition;
  return app;
}
