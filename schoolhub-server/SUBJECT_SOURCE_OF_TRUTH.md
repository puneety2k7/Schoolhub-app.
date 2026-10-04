# Subject source of truth (Server Production)

The canonical Subject source is PostgreSQL table `subjects`, exposed through `GET/POST/PATCH /api/v1/subjects`. Subject Master in Admin Settings uses this API. Deactivation preserves historical references.

| Workspace | Canonical server path |
|---|---|
| Classes & Sections | Subjects are attached through PostgreSQL `teacher_assignments`; no independent class subject list is maintained. |
| Timetable | `/api/v1/subjects` through the server core cache; timetable rows store `subject_id`. |
| Homework | `/api/v1/homework-workspace` references query active PostgreSQL subjects; records store `subject_id`. |
| Teacher Work Log | `/api/v1/work-log-workspace` references query active PostgreSQL subjects; records store `subject_id`. |
| Exams & Results | `/api/v1/exams-workspace` references query PostgreSQL subjects; exams store `subject_id`. |
| Academic Reports | Published exam data joins PostgreSQL `subjects` by `subject_id`. |
| Curriculum | `/api/v1/resource-catalogs/curriculum` now returns active PostgreSQL subjects; the form uses those options rather than a hardcoded list. |
| Teacher/subject assignment | `/api/v1/teacher-assignments` stores `subject_id`; the staff subject selector is populated from Subject Master. |

After Subject Master changes, the core cache is reloaded and the `schoolhub:subjects-changed` event is dispatched so open server consumers can refresh without localStorage fallback.