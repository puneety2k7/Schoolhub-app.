# Server module completion

## Phase 17 controlled communication delivery - 2026-09-16
- Added default-off Admin Settings controls, templates, targeted campaigns, real in-app inbox/read/acknowledgement, scheduled due queue, delivery history and retries.
- External Email/SMS/WhatsApp/Web Push attempts remain honestly Blocked with `PROVIDER_NOT_CONFIGURED`; no delivery is fabricated.
- Schema 33; focused tests 3/3 and combined full regression 133/133 across 35 files passed. See PHASE17_COMMUNICATION_DELIVERY_COMPLETION.md.

## Phase 19 advanced examination logistics - 2026-09-16
- Added default-off, Admin Settings-controlled rooms, capacity checks, clash-safe scheduling, automatic seating, invigilator assignments, publish locks and hall tickets.
- Existing assessments, marks and report-card snapshots remain authoritative; Phase 18 payments were not changed.
- Schema 32; focused tests 2/2 and full backend regression 130/130 across 34 files passed. See PHASE19_EXAM_LOGISTICS_COMPLETION.md.

## Phase 16 admin-controlled portals and PWA - 2026-09-16
- Added a tenant-level Portal & PWA control plane in Admin Settings; every new capability defaults OFF and remains bounded by the server rollout mode.
- Admins control portal access, individual module visibility, teacher write actions, PWA availability, install prompts and the offline application shell.
- Portal reads and teacher writes enforce the saved switches on the server; UI switches alone cannot bypass authority.
- Configuration updates are CSRF-protected, audited, transaction-safe and version-checked. The service worker never caches API responses or school data.
- Full regression passed 128/128 across 33 files; production build and the 11/11 current browser gate passed. See PHASE16_PORTAL_PWA_COMPLETION.md.

## Phase 15 release stabilization - 2026-09-16
- Reconciled the release suite with database schema 31, 24 built-in Workspaces, Workspace factory 12, and supported custom file fields.
- Migration and Workspace tests now derive expected versions/counts from authoritative exported contracts and explicitly cover migrations 24-31.
- Corrected the field-type API so `file` is no longer advertised as deferred; formula/calculated fields remain deferred.
- Full server suite passed 125/125 across 33 files; TypeScript production build passed.
- Added the current asset-aware Phase 15 headless-browser gate; 11/11 passed with no uncaught or resource errors.
- Lean frontend sanity passed 10 automated checks with 0 failures; the audit-pagination warning and two manual checks remain documented.
- Live API and frontend returned HTTP 200 on ports 4010 and 8080.

## Application-wide workspace identity — 2026-09-16
- Existing configured school name/logo now appear in the fixed top bar.
- Shared helper gives each workspace one category/title/description with its original actions; repeated screen banners are suppressed.
- Eleven representative pages, themes, mobile, drawer/navigation and print-header preservation passed focused browser checks.
- No business logic, permissions, data, Workspace Manager or print configuration changes. See WORKSPACE_IDENTITY_COMPLETION.md.

## Personal workspace list views — 2026-09-16
- Columns, Advanced Filter, sorting and Reset My View added to nine server-mode lists.
- Preferences scoped per browser, server, school, user and workspace. Workspace Manager and existing actions preserved.
- Focused browser, unit, source-scope tests and build passed; backend restarted and health/assets verified.
- Scope and deferred adapters: PERSONAL_VIEWS_COMPLETION.md.

## Fixed application frame — 2026-09-16
- Fixed grid frame: 72px top bar, 28px footer; independent content and sidebar scrolling.
- Existing logo/search/year/connection/print/profile controls reused; top-left brand area empty.
- Mobile, Settings, drawers, themes and print-frame exclusion passed focused browser sanity checks.
- No server/business-data/schema changes. See APPLICATION_FRAME_COMPLETION.md.

## Transport standard workspace — 2026-09-16
- Deployed: schema 31 retained, Workspace factory 12. Workspace Manager preserved.
- List/drawer, structured stops, picklist colors, staff/class/section references, print, archive and Super Admin restore.
- Existing route and assignment rows unchanged; backup verified. Focused Transport API/browser checks passed; no full regression.
- Source decisions, exact schema, compatibility notes and verification: TRANSPORT_COMPLETION.md.

## Picklist Manager redesign and color control — 2026-09-16
- Standalone Admin Settings → Data & System → Picklist Manager. Workspace Manager retained; its fields still reference Picklists and link to the standalone editor.
- Structured right drawer, semantic/custom colors, preview, order, safe deactivation and protected canonical system values.
- Schema 31; Workspace factory unchanged at 11. All 21 existing definitions and 121 value identities preserved; unchanged business counts and verified backup.
- Focused API/browser checks passed, including Attendance color inheritance. See PICKLISTS_COMPLETION.md.

## Documents standard workspace — 2026-09-16
- Deployed schema 30 / Workspace factory 11: list-first Documents, filters, right drawer, multi-audience, tags, target references and real attachments.
- Existing catalogue rows preserved; version-aware edits, safe archive and Super Admin restore-as-Inactive. Internal notes excluded from unauthorized reads and printing.
- Focused integration/browser checks and build passed. Verified backup and unchanged business counts. See DOCUMENTS_COMPLETION.md.
- Acknowledgement response tracking and parent/student portal exposure are explicitly deferred; configuration flags are stored.

## Calendar & Holidays standard workspace — 2026-09-16
- Deployed schema 29 / Workspace factory 10: Month/Week/Day/Agenda views, summaries, right drawer, multiple audiences, references, files and event/month printing.
- Existing preloaded/tentative holidays, hide/restore and linked notices preserved; all 24 stored calendar records retained.
- Focused API/browser tests, build and live health checks passed. See CALENDAR_COMPLETION.md.

## Leave Requests standard workspace — 2026-09-16
- Deployed schema 28 / Workspace factory 9: list-first Leave UI, summary cards, filters, right drawer, real Student/Staff references, priority and attachment.
- Existing approval stages, decisionNote, permission checks and archive history retained; pending edits blocked after review begins.
- Focused Leave API and browser tests passed. All business counts preserved; verified backup. See LEAVE_COMPLETION.md.

## Notice/Class optional fields — 2026-09-16
- Deployed schema 27 / Workspace factory 8: notice expiry, priority, attachments and real drafts/publication; class Room and Academic Level / Group.
- Focused API/browser tests and build passed. Existing business record counts unchanged; backup verified. See STANDARD_UI_COMPLETION.md follow-up.

## Notice Board and Classes & Sections — 2026-09-16
- Deployed standard list-first UI, right-side drawers, filters, View/Edit/Print and safe Archive; real staff references and stable section IDs retained.
- Schema 26 unchanged; Workspace Manager factory 7 and supported Picklists synchronized. No business records changed.
- Focused integration/browser checks and build passed. See STANDARD_UI_COMPLETION.md for schemas, checklist, backup and deliberate deferrals.

## Homework workspace — 2026-09-15
- Deployed schema 24 / Workspace Manager factory 4: reference-driven Homework, configurable publication and acknowledgement picklists, real attachments, View/Edit/Print/Archive/Restore, student-owned acknowledgements, and teacher response summaries.
- Focused API and browser sanity checks passed. Desktop/mobile screenshots inspected; existing print engine reused. No full regression.
- Existing portal rollout remains ReadOnly; student writes require Pilot mode. No rollout or Admin Settings changes were made.
- See `HOMEWORK_COMPLETION.md` for the complete requested checklist, exact schemas, relationships, backup and verification details.

## Timetable functionality — 2026-09-15
- Rebuilt Server Timetable with Weekly Timetable, Period Structure, Teacher Timetable and Schedule List views. All screens resolve Academic Year, Class, Section, Subject and Teacher names while preserving their stable PostgreSQL IDs.
- Added server-backed school periods with Teaching Period, Assembly, Short Break, Lunch and Activity types; administrators can add, edit, reorder and safely delete unused periods. No period data was invented or seeded.
- Existing timetable entries remain unchanged and are displayed through preserved legacy period slots when they do not yet reference a configured server period.
- Added cell-based create/edit/delete, optional room and notes, teacher-assignment recommendations, informational teacher workload, responsive day-by-day mobile rendering, class/teacher printing and empty states.
- Class, teacher and room conflicts now return distinct server errors with the conflicting human-readable class/teacher/room context. Writes remain permission, tenant and optimistic-version protected; linked teachers remain assignment scoped.
- Teacher Work Log continues to receive timetable-assisted subject/class/period context, now resolving configured period names. Homework suggestion was deliberately deferred because the current Homework form has no reliable selected timetable period context and manual selection remains available.
- Workspace Manager factory version 3 adds the Timetable Notes field and a Period Structure section with Period Name, Type, Start, End, Duration, Display Order and Active fields. Administrator display customization remains preserved by factory synchronization.
- Migration 23 additively creates `school_periods` and nullable `timetable_entries.notes`; it does not rewrite timetable or master data.
- Verification: TypeScript build passed; all 37 frontend scripts passed syntax validation; focused migration, Timetable and Workspace Manager tests passed 28/28; no full regression was run.

## Attendance functionality — 2026-09-15
- Rebuilt Server Attendance around the existing SchoolHub theme: Date, Class, Section and Session selectors; authorized roster loading; summary cards; searchable student roster; responsive mobile cards; dirty-state warnings; Reset, Mark All Present, Save Attendance and Print Report.
- Attendance statuses are read from the Workspace Manager Picklist Manager using the protected key `attendanceStatus`. The default active values are Present, Absent and Late; administrators can rename labels or add values without changing stored canonical values.
- Roster rows now show roll number, image/name/admission number, configured status controls, arrival time and note. Existing attendance `remark` remains the note store; migration 22 additively introduces nullable `attendance_records.arrival_time`.
- Saving remains PostgreSQL-authoritative, tenant/permission scoped, atomic and optimistic-concurrency protected. Inactive configured values cannot be newly assigned, while unchanged historical values remain readable and correctable without rewriting history.
- Printing uses the SchoolHub print surface and records an `ATTENDANCE_REPORT_PRINTED` audit event. A Save Draft button was deliberately not added because the server has no true attendance-draft record model.
- Deployment verification: TypeScript build passed; all 36 frontend scripts passed syntax validation; focused migration and academic integration tests passed 10/10; backend `/health` and frontend HTTP checks passed.

## Teachers & Staff and Classes & Sections functionality — 2026-09-15
- Server Teachers & Staff now persists and displays Employee ID, name, role, subject, phone, email and status in their correct columns; search, role and Active/Archived filters are functional.
- Active staff rows provide View, Edit, Print and Delete. Delete is a recoverable archive, archived staff can be restored, and printing is audited.
- Teachers & Staff operational forms now consume Workspace Manager sections, labels, required/visibility rules and custom values. Workspace Manager Image fields support preview, replace and remove for JPEG/PNG/WebP with server-enforced size limits.
- Server Classes & Sections now provide search and Active/Archived filtering, resolved class-teacher assignments, View, Edit, Print, recoverable Delete and Restore. Class archival is blocked when active dependent records exist.
- Server teaching assignments now provide View, Edit, Print, recoverable Delete and Restore.
- Local Mode behavior and Admin Settings configuration were preserved; this is functionality work and does not migrate or seed business data.
- Migration 21 adds staff phone, email and custom-field storage and was deployed successfully on 2026-09-15 after a verified PostgreSQL backup.
- Verification: TypeScript build passed; browser JavaScript syntax passed; server suite 114/114 passed; Workspace Manager browser suite 13/13 passed; Admin Settings browser suite 12/12 passed.

## Students functionality — 2026-09-15
- Corrected the Server Students table to render all seven columns in the intended order: Student, Admission, Class / Section, Guardian, Phone, Status and Actions.
- Added PostgreSQL filters for search, class, section and status; class selection now restricts the available section choices.
- Enabled the Admin Settings Admission Form in Server Production, including configured form layout, server classes/sections/academic years and PostgreSQL create/update.
- Added permission-aware View, Admission Form, Edit, Print and Delete actions. Print uses Workspace Manager screen/print visibility and writes an audit event.
- Delete is reversible: it archives the student as Inactive, preserves history, accepts an optional audit reason, and authorized administrators can Restore the record.
- The Promote Students button now opens the existing PostgreSQL-authoritative promotion and academic-year rollover workflow.
- Workspace Manager and Admin Settings configuration behavior was preserved; no student data migration or seed-data change was performed.
- Verification: frontend scripts compile; Workspace Manager browser suite 13/13 passed; server suite 113/113 passed.

## Server Dashboard functionality — 2026-09-15
- Replaced the Phase 12 count-only Server Production dashboard renderer with the shared responsive dashboard card design.
- Dashboard cards now provide permission-aware navigation; quick actions are filtered from server permissions.
- Added explicit loading, retry/error, responsive, print-compatible and partial recent-activity failure states.
- Added a direct, permission-protected route from Quick Actions to Admin Settings → Workspace Manager without changing Workspace Manager metadata or Admin Settings behavior.
- Verification: all 36 inline scripts compile; current Workspace Manager browser suite 13/13 passed; server suite 111/111 passed; the Phase 12 production-browser dashboard authority check passed.
- The older Phase 12 pack still has six unrelated stale version/schema/module-boundary expectations because the application is now WM-2/Phase 14 with Schema 16.

## Editor fixes applied
- Normalize new section keys before submission (Testing1 becomes testing1).
- Generate section keys from the name.
- Show operation errors inline while preserving the form.
- Expose Add Custom Field at workspace level, including empty workspaces.
- Existing browser regression suite: 12 passed.

## Live verified modules — 2026-09-15
- Notices and Calendar: server persistence, original forms, ranges, holiday overrides and linked notices.
- Documents metadata and Rules: server persistence using original screens.
- Uniform and Curriculum: original forms, images/PDFs in PostgreSQL, duplicate protection and class validation.
- Transport: original route fields, student assignments, stop checks, version conflicts and transactional route archival.
- Teacher Work Logs: original editor, school/teacher authorization, five attachments, preview/download, edits and reload.
- Browser save/edit/refresh checks passed for all eight modules. Backend regression: 92/92 passed.
- Deployed database migration 13 (teacher_work_logs), including migration 12 (transport_operations); startup health check passed.
- Verified pre-deployment backup: backups/schoolhub-before-transport-worklogs-20260915-134819.dump.
- Verified pre-deployment backup: backups/schoolhub-before-resources-20260915-133229.dump.
- Historical browser-only records have NOT been imported; they remain separate.

## Completed in source, not deployed — 2026-09-15
- Migrations 14-16 now cover configurable workflows/Leave, Fees, and Certificates. All routes are registered in the production app.
- Leave keeps workflow snapshots, pinned protected final actions, role responsibility and staged decisions; its adapter is embedded in the single-file app.
- Fees now includes payments, idempotent receipt numbering, voids, approval-backed corrections, structure editing/archival, individual student assignments, original-screen integration and server audit events.
- Certificates now includes server-side student snapshots, configured approval stages, per-type gap-free numbering, immutable template snapshots, issued history, optimistic concurrency and audited reprints.
- General Reports now reads permission-scoped PostgreSQL students, attendance, Fees, published exams and marks; server verification totals are reconciled in the browser before preview/printing, and prints are audited.
- Backend compilation passes. Regression suite: 99/99. Browser inline-script/startup suite: 12/12.

## Current deployment state
- The live PostgreSQL database is at schema 23; migration 23 was applied on 2026-09-15.
- Pre/post counts matched: 11 classes, 25 sections, 50 staff, 11 subjects, 900 timetable entries, 975 homework records, 1,200 work logs, 137,000 attendance records, 750 exams and 1 academic year. No protected business records were migrated, seeded or rewritten.
- Verified backup: `backups/schoolhub-before-timetable-redesign-20260915-215950.dump` (1,886,488 bytes; SHA-256 `B45C4D18DEA2432368E97681CC72C5F5626C061681C5BACCE59E29C6097FF914`; 414 TOC entries).
- Backend restarted successfully on port 4010 and `/health` returned `ok`; the updated frontend and operational custom-field asset returned HTTP 200.

## Still pending
- Extend operational Workspace custom-field consumption beyond Students and Teachers & Staff where required.
- Complete the remaining Server-versus-Local functionality audit for Homework and Exams & Results.
- Run authenticated UI acceptance checks when the Windows computer-control helper is available; automated server and browser regression suites already pass.
- Complete the remaining module end-to-end validation and full restore rehearsal.

## Findings
- Enhanced Calendar now persists its events and linked notices on the server.
- Curriculum and Uniform retain image/PDF controls, with server file-type validation and a 10 MB limit per attachment.
- Workspace field creation currently saves metadata only; it must not be described as operational custom-field completion.
- Production unavailable guards remain in place until each module is implemented and verified.
- Leave, Fees and Certificates share the existing configurable workflow engine. Preserve workflow snapshots, stage-by-stage decisions, protected final actions and role responsibility; do not replace them with direct status updates.
## Latest update — 15 September 2026: Teacher Work Log

- Teacher Work Log redesign deployed: schema 25 and Workspace factory 5.
- Timetable references/autofill, substitution reasons/conflicts, historical snapshots, drawer, actions and attachments implemented.
- Focused server and browser checks passed; no full regression run for this phase.
- Existing business record counts preserved. Detailed acceptance checklist, schema and limitations: WORK_LOG_COMPLETION.md.
- Earlier deployment entries below are historical; the current live schema is 25.
## Latest update — Exams & Results

- Deployed schema 26 and Workspace factory 6; restored Assessments, Marks Entry, Report Cards and Co-Scholastic.
- Focused server and browser tests passed. Existing 750 assessments, 15,000 marks and 1,000 report snapshots preserved.
- See EXAMS_COMPLETION.md for verification, backup, Designer connection and published-report protections.
- Earlier deployment entries below are historical; current schema is 26.
