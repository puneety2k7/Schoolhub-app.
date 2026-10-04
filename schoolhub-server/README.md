# SchoolHub Server 14.0.0-wm2

This directory contains the current SchoolHub PostgreSQL-authoritative server: application 14.0.0-wm2, database schema 31, Workspace factory 12, and 24 built-in Workspaces. Production authority now covers core identity and academics plus attendance, timetable, homework, work logs, exams/results, fees, leave, notices, calendar, documents, certificates, reports, resources, transport, and related operational workflows. Local and Server Pilot modes remain available for compatibility and controlled rollout.

## Requirements

- Node.js 22 or newer.
- PostgreSQL 15 or newer, hosted on the same trusted network or behind TLS.
- A dedicated database and least-privilege application role that owns only the SchoolHub schema.

For a Windows installation, copy the root `schoolhub.config.env.example` to `schoolhub.config.env`, edit that single file, and run the root `Setup-SchoolHub.bat`. Do not maintain a second server `.env` file. See [PHASE11_UNIFIED_CONFIGURATION.md](PHASE11_UNIFIED_CONFIGURATION.md).

No administrator is created automatically. With an empty database, use `POST /api/v1/setup` once or the frontend's “First server setup” action. Use a unique strong password; there is no built-in password.

## Modes and trust boundary

- **Local:** the browser application and its existing local backup behavior remain authoritative.
- **ServerPilot:** authentication and migrated pilot domains come from /api/v1.
- **ServerProduction:** PostgreSQL is the explicit authority for every server-supported domain; failed API reads never fall back to browser-local school records. Authentication remains in an HTTP-only server cookie.

Server failures never cause an automatic fallback. Any feature not yet exposed through a role portal or specialized client remains unavailable there rather than reading local school data.

## API and security

- Contract base: `/api/v1`.
- Argon2id password hashing; imported local passwords are ignored.
- SHA-256 session-token lookup, random 256-bit tokens, server expiry, logout invalidation, and other-session invalidation after password change.
- HTTP-only, SameSite=Strict cookies; `Secure` is mandatory in production configuration.
- Strict Zod request validation, parameterized SQL, tenant filters, server permission checks, assignment joins, CSRF token validation, restricted CORS, security headers, 25 MiB body limit, generic login failures, and login throttling.
- Logs redact cookies, authorization headers, and password fields. API errors never return stack traces.

Deploy behind HTTPS and a reverse proxy. Keep `ALLOWED_ORIGINS` restricted to the exact frontend origins. Do not expose PostgreSQL publicly.

## Database backup and recovery

A frontend JSON export is **not** a server disaster-recovery backup.

Create a PostgreSQL custom-format backup:

```text
pg_dump --format=custom --no-owner --file schoolhub-YYYYMMDD.dump "$DATABASE_URL"
pg_restore --list schoolhub-YYYYMMDD.dump
```

Restore into a new empty recovery database first:

```text
createdb schoolhub_recovery
pg_restore --exit-on-error --single-transaction --dbname schoolhub_recovery schoolhub-YYYYMMDD.dump
```

Verify the migration history, school/user/student counts, foreign keys, a scoped teacher query, and a test login before directing production traffic to the restored database. Stop the application or use a consistent managed snapshot when taking backups. Keep encrypted copies in a separate failure domain and test restores regularly.

Migrations are forward-only. Roll back application code only when the deployed database schema remains compatible; otherwise restore the verified pre-migration database backup. To recover an import, restore the pre-import database backup or remove the import in a reviewed maintenance transaction--never delete browser data.

Rotate the database role password in PostgreSQL and update the deployment secret store, then restart the server. To invalidate all sessions safely, execute `DELETE FROM sessions;` as an authorized maintenance operation. Password changes automatically invalidate a user's other sessions.

## Testing

`npm test` uses an isolated in-memory PostgreSQL-compatible database and never connects to production. A real PostgreSQL integration run is still required before production deployment:

1. Provision a disposable PostgreSQL database.
2. Set `DATABASE_URL` only for that test process.
3. Run migrations twice and confirm the second run applies nothing.
4. Run API tests, the 1,000-student import benchmark, the current Phase 15 browser gate, backup/restore rehearsal, and `npm audit`.
5. Drop the disposable database.

Graceful shutdown is supported for SIGINT and SIGTERM.

For VM deployment, follow [VMWARE_CLOUD_DEPLOYMENT.md](VMWARE_CLOUD_DEPLOYMENT.md).


## Phase 9 diagnostics

See PHASE9_DIAGNOSTICS_AND_LOGGING.md for client/server log separation, redaction, retention, protected endpoints, the support bundle, and Windows launcher instructions.


## Phase 10 role portals

See PHASE10_PORTALS_AND_ROLLOUT.md for portal identity links, server-side scope, rollout modes, operational tables, verification, and rollback.


## Phase 11 unified installation

See [PHASE11_UNIFIED_CONFIGURATION.md](PHASE11_UNIFIED_CONFIGURATION.md) for the single configuration file and idempotent Windows setup/start/stop/status workflow.


## Phase 12 production authority

See [PHASE12_PRODUCTION_DATA_AUTHORITY.md](PHASE12_PRODUCTION_DATA_AUTHORITY.md), [PHASE12_MIGRATION_MATRIX.md](PHASE12_MIGRATION_MATRIX.md), and [PHASE12_VERIFICATION.md](PHASE12_VERIFICATION.md).

## Phase 15 release stabilization

The current automated release commands are `npm test`, `npm run build`, and `node ../SchoolHub_Lean_Test_Pack_v2/run_schoolhub_phase15_tests.js`. The Phase 1-12 browser scripts are historical phase-contract packs and contain obsolete version, schema, asset-serving, and module-boundary assumptions; they are not the current release gate.

Before a production release, also run `npm run test:postgres` against a disposable PostgreSQL database, perform a real backup/restore rehearsal, complete authenticated browser acceptance for the main roles, and run the registry-backed dependency audit with explicit authorization. See [PHASE15_RELEASE_VERIFICATION.md](PHASE15_RELEASE_VERIFICATION.md) for the latest gate record.
