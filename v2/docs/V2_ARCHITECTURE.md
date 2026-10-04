# SchoolHub V2 — foundation architecture

V2 is a clean-slate rebuild. It shares no code, schema, migration or data with the old SchoolHub, and connects only to the
`schoolhub_v2` database. The old application is requirement reference only.

## Stack
Backend: TypeScript, Fastify, PostgreSQL (`v2/server`). Frontend: React, TypeScript, Vite (`v2/frontend`). Shared contract
(permission catalogue, standard actions, lifecycle table, field types): `v2/shared`.

## One architecture for every operational workspace
Dashboard + MAIN + GRID_1 + GRID_2 + GRID_3. Workspace → Tab → Section → Field is defined only in the Workspace Manager and
stored in `workspaces / workspace_tabs / workspace_sections / workspace_fields / workspace_forms / workspace_action_settings /
dashboard_components`. The frontend renders from `GET /api/workspaces/:key/runtime`; there is no per-workspace code.

## Data model (migrations 001–004)
`records(workspace_id, tab_key, state, field_values jsonb, version, owner/created/updated/archived by+at)`.
Reference fields are validated against real records and mirrored in `record_references` (`ON DELETE RESTRICT`), which blocks
permanent deletion of a referenced record. No per-workspace tables.

## Permissions
`shared/src/permissions.ts` is the 41-selection catalogue (Dashboard 1 + 4 tabs × 5 + 20 special). Access is
User → Group → Role (per workspace) → `role_permissions`. System Administrator is `users.system_administrator`: the check
short-circuits in `Entitlements` and no permission rows exist for it. WORKSPACE_ADMINISTRATOR widens normal tab permissions and
record scope only; it never grants VIEW_ARCHIVED_RECORDS, RESTORE_ARCHIVED_RECORDS or PERMANENT_DELETE. Dashboard VIEW gates
only the Dashboard; dashboard components additionally require VIEW on their source tab.

## Standard actions (the only ones in scope)
Add, View, Edit, Print, Archive, Restore, Permanent Delete. `shared/src/actions.ts` defines the lifecycle (Active: View, Edit,
Print, Archive; Archived: View, Print, Restore, Permanent Delete; Add only on the tab toolbar) and the required permissions. The
backend `RecordService` and the frontend `selectActions` use the same table. Add always creates a record of the tab it was
invoked on.

## Out of scope in the foundation
Unique/domain actions, imports, record assignment, per-field permissions, workspace relations beyond MAIN-record references,
old-data migration, and every named workspace (Students etc.), which are implemented one at a time after approval.
