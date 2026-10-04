# Notice Board and Classes & Sections — 2026-09-16

## Follow-up: all reference fields implemented

Supersedes the optional-field deferrals below. Deployed schema 27 / Workspace factory 8.
- Notices: optional expiry date, priority Picklist (Low/Normal/High/Urgent), real attachments (maximum five, 10 MB each), Save Draft and Publish Notice.
- Classes: optional Room and Academic Level / Group, saved and displayed in View/Print.
- Drafts allow incomplete audience/message; publication requires both. Published notices cannot silently revert to drafts.
- Existing notices default to Published. Drafts are excluded from the published communications feed; expired notices are also excluded from that feed while retained in management.
- Attachments reuse existing file validation, with authenticated download, retention/removal, tenant checks and atomic save. Archived notice attachments cannot be downloaded.
- New fields registered in Workspace Manager; noticePriority and Draft status available in Picklists. Existing administrator configuration retained.

Added storage: classes.room text, classes.academic_group text; school_communications.expiry_date text nullable, priority text, publication_state text (Draft/Published). New notice_files table: id, school_id, notice_id, name, type, size, content, archived, created_at.
No existing class, section or notice record was removed. All monitored business counts unchanged.

Verification: build PASS; focused API tests PASS (fields, upload/download, draft/publish, invalid dates/files, foreign attachment ID, stale version); browser PASS (persist/reopen, file upload, draft publication, filters, actions, mobile, zero console errors). Live health and asset checks PASS.
Backup: backups/schoolhub-before-standard-fields-2026-09-16T01-31-10-841Z.dump
SHA256: 11867995d71b8df45d2d9c3d970fa7bb924f11dc775ecdaf0c231d8e021797d0

The original phase report below is retained as historical context.

Deployed to the current application. API health and frontend asset checks passed. Refresh with Ctrl+F5.

## Verification

| Check | Notice Board | Classes & Sections |
|---|---|---|
| Reference UI followed using existing styles | PASS | PASS |
| Right-side drawer | PASS | PASS |
| Filters | PASS | PASS |
| View | PASS | PASS |
| Edit | PASS | PASS |
| Print using existing engine | PASS | PASS |
| Delete/Archive safety | PASS | PASS |
| Workspace Manager metadata | PASS | PASS |
| Picklist Manager | PASS | PASS |
| Mobile cards | PASS | PASS |
| Class Teacher reference | N/A | PASS |
| Section handling | N/A | PASS |

Permissions preserved: YES. Server authority preserved: YES.
Console/API errors: PASS in focused isolated tests; expected conflict responses were verified.
Build passed. No full regression was run.

## Exact storage and references

No business schema migration: schema remains 26. Workspace factory metadata upgraded to 7, retaining administrator customizations.

Notice storage remains school_communications:
id text PK; school_id text FK schools; event_date text; title text; audience text; body text; status text constrained to Published/Calendar; archived boolean; created_by text FK users; source_event_id text nullable; created_at/updated_at timestamptz; version integer.
Notice API maps event_date to date and body to text. The Notice list excludes Calendar rows. Archived records display Inactive without changing the stored publication status.

Class storage remains classes:
id text PK; school_id text FK schools; name text; active boolean; created_at/updated_at timestamptz; version integer; unique(school_id,name).
UI status maps to active. studentCount is calculated, not stored.

Section storage remains sections:
id text PK; school_id text FK schools; class_id text FK classes; name text; active boolean; created_at/updated_at timestamptz; version integer; sort_order integer; unique(school_id,class_id,name).
Renaming retains section IDs. New sections receive new IDs. Referenced section removal and class archival are blocked.

Class teachers reuse teacher_assignments:
id, school_id, teacher_id (staff), academic_year_id, class_id, optional section_id and subject_id, assignment_type, valid_from, valid_until, active, created_at, updated_at, version.
The drawer manages the active-year, class-level ClassTeacher assignment only. Section-specific and subject assignments remain unchanged. Multiple existing class-level assignments require resolution rather than silent overwrite.

Workspace references:
- classes.sections → sections (multiple, parent-child).
- classes.classTeacherId → staff; persisted through teacher_assignments.
- notices.createdBy → users (read-only).
- Existing school, academic-year, class and section IDs remain authoritative.

Picklists:
- noticeAudience: All, Students, Parents, Teachers.
- noticeStatus: Published, Inactive.
- classStatus: Active, Inactive.
Existing configured values are preserved; missing lists are provisioned.

## Scope and deliberate deferrals

Notice drafts, attachments, expiry and priority are omitted because the existing backend does not support them. Class room/group fields are also omitted. No simulated controls or invented records were added.
Notice archive is non-destructive; this phase does not add a Notice restore action. Classes retain an authorized restore action. Dependency checks conservatively include historical records.
Workspace Manager registers supported fields and reference types; this is not a new generic custom-field renderer. Local-mode screens and unrelated modules are unchanged.

## Deployment safety

Verified backup: backups/schoolhub-before-standard-ui-2026-09-15T18-36-55-000Z.dump
SHA256: 1f9e2c25ab2b5b414d87223ad0ed3057cd3e61f179140613d78835d8b04ffa15
All checked business counts unchanged, including students, staff, classes, sections, assignments, notices, attendance, homework, timetable, work logs, exams, marks and published report snapshots.
UI tests used an isolated database, not live school records. Screenshots are in output/standard-ui-sanity.
