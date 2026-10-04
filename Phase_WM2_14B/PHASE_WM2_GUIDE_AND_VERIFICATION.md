# SchoolHub Phase WM-2 / Phase 14B

## Outcome

Phase WM-2 adds an administrator-facing Workspace Manager for PostgreSQL-authoritative metadata. Existing module screens remain authoritative; approved custom fields are consumed by the Students and Teachers & Staff operational forms and PostgreSQL records.

## Administrator flow

1. Sign in to **Server Production** with a role containing `workspaces:view`.
2. Open **Workspace Manager** under System.
3. Search or filter the 19 built-in and any custom workspaces by category, type, or lifecycle.
4. Open a workspace to inspect its sections, fields, stable keys, protection state, factory version, and metadata version.
5. With `workspaces:configure`, edit safe properties, add sections/fields, copy or reorder fields, preview the definition, and activate Draft metadata.
6. With `workspaces:create`, create a custom workspace. It always starts as Draft.
7. With `workspaces:archive`, archive a custom Active workspace. Metadata remains recoverable.
8. With `workspaces:reset`, preview and confirm a built-in factory reset. The operation preserves operational records and custom metadata.

SchoolHub uses the lifecycle names **Draft / Active / Archived**. “Active” was retained deliberately for compatibility with WM-1.

## Safety and permission rules

- The server, not the browser, enforces every permission and school boundary.
- Stable workspace, section, and field keys are immutable.
- Protected system-field properties cannot be changed through a manipulated browser request.
- Built-in workspaces cannot be archived or deleted.
- System sections are not offered an Archive action in the WM-2 interface.
- Stale edits return `RECORD_VERSION_CONFLICT`; the interface explains the conflict and reloads current metadata.
- Select/radio option values are validated, unique, versioned, tenant-scoped, and stored in the existing `workspace_field_options` table.
- Reset preview is read-only. Reset is transactional, audited, and creates version snapshots.
- Authentication, CSRF checks, correlation IDs, redacted logs, and audit events remain active.
- The navigation entry is hidden in Local mode and for users without `workspaces:view`.

## Supported fields

Text, long text, integer, decimal, currency, date, date/time, boolean, checkbox, radio, single-select, multi-select, email, phone, URL, static text, heading, Matrix, workspace reference, and Image. Image values are currently enabled for operational Students and Teachers & Staff fields and accept JPEG, PNG, or WebP with a server-enforced configurable limit (default 5 MB, maximum 10 MB).

Deferred: general files, formulas, and calculated fields. The UI marks these as future features and the API rejects them.

## Backup and recovery

Pre-change source backup:

`D:\School Project\School app\Phase_WM2_14B\backup-before-change-20260915-0901`

Pre-change PostgreSQL backup:

`D:\School Project\School app\backups\schoolhub-pre-migration-20260915-090012.dump`

Recovery options:

- Restore the backed-up source files to return to the pre-WM-2 interface.
- Metadata mistakes should normally be recovered with version history, archive, or built-in factory reset.
- Database restoration should be a last resort and must use a verified dump in a controlled maintenance window.
- Uninstall or interface rollback must not delete the PostgreSQL database or backup directory.

## Implementation footprint

- One contained frontend module: `Phase_WM2_14B/assets/workspace-manager.js`, embedded once into the self-contained application HTML.
- Existing WM-1 routes and tables are reused.
- Small backend additions: select/radio option persistence, reset preview, permission visibility in authenticated responses, and focused failure auditing.
- No new database migration and no operational workspace-record table.

## Verification evidence

- Server regression: 86/86 passed.
- Focused workspace integration: 13/13 passed.
- WM-2 static/browser acceptance: 11/11 passed.
- Phase 13 compatibility: 21/21 passed.
- Phase 1 baseline/browser/performance: 57/57 passed; 1,000-student JSON parse 135 ms and state migration 184 ms.
- TypeScript production build: passed.
- PostgreSQL Schema 8 remained additive and current.

## Known limitations / next phase

Active metadata is configuration only. It does not create dynamic menus, forms, record storage, references, workflows, formulas, files, or reports. A future WM-3 should design the generic operational-record runtime and dependency model before any of those features are enabled.
## WM-2.1 Admin Settings integration

Workspace Manager now appears as its own authorized Server Production page under **Admin Settings → Data & System**. It remains separate from **Application Custom Fields**:

- Application Custom Fields extends fixed operational modules.
- Workspace Manager fields define configurable workspace metadata.

The duplicate main-sidebar Workspace Manager entry is removed. Local mode continues to use Application Custom Fields unchanged.
