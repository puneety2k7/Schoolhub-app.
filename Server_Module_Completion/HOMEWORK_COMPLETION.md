# Homework workspace completion — 15 September 2026

Deployed to the existing SchoolHub application. PostgreSQL schema 24 and Workspace Manager factory 4 are installed. Server health check passed. Testing used isolated data, not the live Class 1 records. No full regression was run.

## Important live setting

The existing portal rollout remains **ReadOnly** (the configured default). Student acknowledgement writes were verified in an isolated Pilot-mode test. On the live installation they remain disabled until the existing `PORTAL_ROLLOUT_MODE` setting is intentionally changed to `Pilot`. No Admin Settings, credentials, or rollout settings were changed.

## HOMEWORK UI

Reference UI followed: PASS — clean table, compact filters, status badges, blue actions and right drawer; existing school branding/theme retained.

Add Drawer: PASS

View: PASS

Edit: PASS — prefilled fields and version protection; published recipient relationships cannot be changed, including after restoration.

Print: PASS — existing `printWindow` engine and global school header; generated print document checked, physical printing not tested.

Delete/Deactivate: PASS — archives without deleting attachments or acknowledgement history; administrator restore returns the record to Draft for review.

Mobile: PASS — cards instead of a compressed desktop table; screenshot inspected.

## WORKSPACE MANAGER

Homework workspace registered: YES

| Field | Type |
|---|---|
| Academic Year | workspaceReference |
| Class | workspaceReference |
| Section | workspaceReference; depends on classId |
| Subject | workspaceReference |
| Teacher | workspaceReference |
| Title | text |
| Instructions | longText |
| Assigned Date | date |
| Due Date | date |
| Status | singleSelect linked to Homework Status |
| Attachments | file; real server storage, maximum five files/10 MB each |
| Created By | read-only workspaceReference to system users |
| Created At / Updated At | read-only dateTime |
| Acknowledgements | read-only multiple workspaceReference |

Existing field labels, ordering and visibility are retained during factory upgrades. The Homework drawer uses field metadata; list labels/visibility and print visibility follow the workspace definition. Required hidden fields produce an explicit validation error rather than silently saving incomplete records.

## PICKLIST MANAGER

Homework Status: PASS

Acknowledgement Status: PASS

Hardcoded dropdown values removed: YES — reference choices and status choices are server supplied; placeholder choices are not business values.

Created/reused:

- `homeworkStatus` — **Homework Status**: stable existing publication codes `Draft`, `Published`, `Inactive`. The existing database codes are retained for compatibility; labels are editable. Overdue is derived, not stored.
- `homeworkAcknowledgementStatus` — **Homework Acknowledgement Status**: `ASSIGNED`, `SEEN`, `IN_PROGRESS`, `COMPLETED`, `NEED_HELP`.
- Labels, order and active/inactive flags are editable in Picklist Manager. Existing Homework status codes cannot be deleted/renamed; disable them instead to preserve historical identity. Student controls use active values from this list.

## WORKSPACE REFERENCES

Academic Year source: existing `academic_years`, exposed as Academic Years reference workspace.

Class source: existing `classes`.

Section source: existing `sections`, constrained to selected class.

Subject source: existing `subjects`, not duplicated Curriculum strings.

Teacher source: existing `staff`; linked teacher defaults only when an actual identity link exists.

Homework relationships: academicYearId → academic-years; classId → classes; sectionId → sections; subjectId → subjects; teacherId → staff; createdBy → users; attachments → homework_files; acknowledgements → homework-acknowledgements via homeworkId.

Acknowledgement relationships: homeworkId → homework; studentId → students; statusCode → Homework Acknowledgement Status.

## ACKNOWLEDGEMENT

Per-student model: PASS

Seen: PASS

In Progress: PASS

Completed: PASS

Need Help: PASS

Teacher summary: PASS — counts only actual responses and shows student/admission/status/note/update details.

Student security: PASS — student identity comes from the authenticated session; no submitted studentId is accepted. Draft/inactive/out-of-scope homework and files are unavailable to students. Teachers cannot alter student responses. Student mutation remains restricted by the portal rollout setting noted above.

Opening homework does not automatically record Seen or another response.

## SERVER

PostgreSQL authority preserved: YES

Permissions preserved: YES — school scope, teacher assignment scope, authenticated student scope and portal rollout restrictions remain enforced. The portal navigation guard now recognizes both Server Pilot and Server Production.

Version protection preserved: YES — homework and acknowledgements reject stale updates; transaction/row locking prevents concurrent acknowledgement races.

Console/API errors: PASS — targeted browser and API scenarios; no blanket claim about unrelated modules.

## Exact database schema

`homework_records` (existing, reused):

`id text PK`, `school_id text FK`, `academic_year_id text FK`, `class_id text NOT NULL FK`, `section_id text FK`, `subject_id text FK`, `teacher_id text FK`, `title text NOT NULL`, `instructions text NOT NULL`, `assigned_date date NOT NULL`, `due_date date`, `status text NOT NULL`, `created_at timestamptz`, `updated_at timestamptz`, `version integer`, existing `published_at timestamptz`, `deactivated_at timestamptz`, `attachment_metadata jsonb`; migration 24 adds nullable `created_by text FK users`.

New writes require year/class/section/subject/teacher/title/instructions/assigned date/due date, and due date must not precede assigned date. Existing nullable values are not fabricated or rewritten.

`homework_files` (new):

`id text PK`, `school_id text NOT NULL FK schools`, `homework_id text NOT NULL FK homework_records`, `name text NOT NULL`, `type text NOT NULL`, `size integer NOT NULL`, `content text NOT NULL` (base64 file bytes), `archived boolean NOT NULL DEFAULT false`, `created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`.

Uses the existing work-log attachment validator and PostgreSQL storage pattern. Existing metadata-only attachment entries are preserved but are not presented as downloadable uploads.

`homework_acknowledgements` (new):

`id text PK`, `school_id text NOT NULL FK schools`, `homework_id text NOT NULL FK homework_records`, `student_id text NOT NULL FK students`, `status_code text NOT NULL`, `acknowledged_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`, `completed_at timestamptz NULL`, `student_note text NOT NULL DEFAULT ''`, `updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`, `version integer NOT NULL DEFAULT 1`; unique `(school_id, homework_id, student_id)`.

Migration 24 `homework_files_acknowledgements` is additive. All 975 pre-existing Homework records were reused without data rewriting. Class, section, subject, teacher, year, student and user values remain stable IDs internally; names are resolved from the existing source tables.

## Verification and backup

- TypeScript build passed.
- Focused `tests/integration/homework-workspace.test.ts` passed: metadata, draft/edit/publish, file retrieval, stale-version rejection, student status changes, teacher summary, access restrictions, archive/restore and retained history.
- `tests/homework-browser.ts` passed: Add/Edit/Publish/View/Print/Archive/Restore, real student portal acknowledgement, desktop drawer, mobile cards, human-readable labels and zero captured runtime/console errors.
- Screenshots: `output/homework-sanity/desktop-drawer.png` and `mobile.png`.
- Deployment backup: `backups/schoolhub-before-homework-2026-09-15T17-19-41-749Z.dump` (2,066,998 bytes; verified pg_restore table of contents).
- SHA-256: `9b4ad616d05bfd4ccf89dd67e43dbf5c2015ce48c8288e4e6c88d277f41ad14a`.
- Business counts preserved through deployment: students 1000, staff 50, classes 11, sections 25, subjects 11, academic years 1, homework 975, attendance 137000, teacher work logs 1200, timetable entries 900. Archived records are included in these physical row counts.

## Separate user-requested Class 1 cleanup

Archived 909 students and 14 teachers. Preserved 91 Class 1 students and 36 teachers linked to Class 1, including shared teachers. Non-teaching staff and historical records were not deleted. Existing restore operations remain available; per-record audit events recorded the former status/version. Backup: `backups/schoolhub-before-class1-archive-20260915-221606.dump`.

## Deliberately deferred / unchanged

- Live student write activation: existing ReadOnly rollout intentionally preserved; requires an explicit configuration decision.
- Optional timetable/work-log suggestions: deferred where the Homework form lacks a reliable selected lesson context. Manual references remain available.
- No grading, marks integration, AI generation, WhatsApp, submission uploads, plagiarism detection or analytics were added.
- No reconstruction of historical file bytes or historical creator identities from missing data.
- No full regression; external QA remains responsible for broader module coverage.
