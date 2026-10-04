# Exams & Results — completed 15 September 2026

## Delivered
- Restored four server-mode tabs: Assessments, Marks Entry, Report Cards, Co-Scholastic.
- Assessments: working year/class/section/subject/status/search filters, 20-row pages, readable labels and calendar dates. Removed the old 500-record retrieval limit; verified all 750 live assessments load.
- Actions: View, Edit, Print, Marks, Publish, audited Open Correction, confirmed Delete/archive, administrator Restore from Archived status.
- Published results remain locked. Deletion does not permanently erase marks. Archived assessments restore to their prior Draft/Correction state.
- Marks Entry loads only students enrolled in the exam year/class/section, plus their saved marks and record versions. Saves only changed rows, supports absent/not-entered values, validates maximum marks, rejects stale changes and locks during publication.
- An assessment containing marks cannot be moved to a different class/year/subject. Its maximum cannot be lowered below saved marks.
- Report Cards use the existing SchoolHub report renderer and print engine. Detailed snapshots and legacy summary-only published reports both display correctly. Old summaries are not filled with invented current results.
- Co-Scholastic evaluations save to PostgreSQL by student, academic year and stable skill identifier, with optimistic version protection and audit history. Skills come from Report Card Designer.
- Desktop table and mobile assessment cards; existing theme and school branding retained.

## Workspace and settings integration
Workspace factory version 6 updates Academic Year, Class, Section and Subject references; result fields and Co-Scholastic skill/rating fields are registered.
Existing administrator labels, custom metadata and settings are preserved. This phase does not introduce a generic arbitrary custom-field renderer.

Report Card Designer uses its existing UI, with server loading/saving added. It persists to a separate versioned configuration record rather than overwriting unrelated school settings.

If no Designer configuration is yet saved on the server:
1. Open Co-Scholastic, select the academic year/class/student, and load the evaluation.
2. An authorized administrator can choose **Use current Report Card Designer settings**.
3. Confirm to connect the currently configured skills and template. Alternatively save through Admin Settings → Report Card Designer.

No local student evaluations or exam data are automatically imported.

## Data model
Schema migration 26: exam_workspace_evaluations.
- exam_records: added nullable archived_from_state text. Existing exam_records and mark_records remain authoritative.
- exam_report_configuration: school_id primary key/FK schools; configuration jsonb; version integer; updated_by FK users; updated_at timestamptz.
- co_scholastic_evaluations: id primary key; school_id FK schools; student_id FK students; academic_year_id FK academic_years; skill_id text; skill_name text snapshot; rating text; version integer; updated_by FK users; updated_at timestamptz.
- Unique evaluation key: (school_id,student_id,academic_year_id,skill_id).
- Ratings retain the existing free-text model; no duplicate master-data picklists were introduced.
- Published report snapshots now include Designer configuration, Co-Scholastic ratings and readable historical enrollment context when newly generated. Existing published snapshots were not rewritten.

## Verification
PASS: TypeScript build.
PASS: focused integration tests for roster scope, mark reload/save, stale versions, range checks, exam context protection, publication locking, report snapshots, evaluations and archive/restore.
PASS: isolated browser test for all four tabs, assessment creation, scoped marks, configured evaluation save, publication, detailed report preview/printing, legacy summary compatibility, desktop and mobile.
PASS: zero unexpected browser runtime/console errors.
PASS: live /health returned ok; frontend module returned HTTP 200.
PASS: read-only live verification loaded 750 assessments and every displayed exam date matched its stored calendar date.
No full regression run.

## Backup / preserved data
Verified backup:
backups/schoolhub-before-exams-2026-09-15T18-12-21-889Z.dump
2,107,275 bytes.
SHA-256: 04256d1cd3184db7c63afc574eb17d6fd0a6a518a2178184240eeaf65d4e56fc

Before/after physical counts matched:
students 1000; staff 50; classes 11; sections 25; subjects 11; academic years 1;
homework 975; attendance 137000; work logs 1200; timetable entries 900;
assessments 750; marks 15000; published report snapshots 1000.

Tests used an isolated database. No live test records were added.
Earlier Class 1 archive choices were preserved.

## Important protections / limitations
- A published report card is an immutable snapshot. Its Co-Scholastic evaluations cannot be changed through the new editor; no report-unpublish/correction workflow was invented.
- Existing summary-only report cards contain percentage/grade/status/attendance, not detailed assessment rows. Their stored summaries are shown faithfully.
- Published exam correction is retained; correcting marks does not rewrite an already-published report-card snapshot.
- Classroom relationships and historical enrollment are reused, not duplicated.
- UI tests used an administrator account. Dedicated teacher/mobile-device acceptance beyond the isolated browser checks was not run.

