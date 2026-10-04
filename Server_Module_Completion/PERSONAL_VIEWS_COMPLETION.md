# Personal workspace list views — 2026-09-16

## Delivered

Server-mode list views now offer **Columns**, **Advanced Filter**, and **Reset My View** in these nine workspaces:

- Students
- Teachers & Staff
- Classes & Sections
- Homework
- Teacher Work Log
- Notice Board
- Leave Requests
- Documents
- Transport

Each user can hide/show existing permitted table columns, move them up/down, combine up to ten conditions using ALL (AND) or ANY (OR), and select a sort field/direction. Cancel does not save. At least one information column stays visible, and Actions cannot be hidden. Reset restores only the personal view; existing quick filters remain.

Conditions support text comparisons, references/picklist equality, numeric/date ranges and comparisons, and empty/not-empty checks. Reference choices reuse authorized model IDs and human-readable labels. Filtering precedes native list pagination and combines with existing quick filters. Mobile cards retain their existing layout; personal filters affect their records, while column preferences apply to the desktop table.

## Storage and boundaries

- Browser-local preferences only, keyed by API base URL + school slug + signed-in user ID + workspace key. Preferences survive refresh in the same browser; they are not synchronized across devices and are lost if browser storage is cleared.
- Preferences contain view configuration, not copies of business records. Storage failures are shown instead of claiming a successful save.
- Workspace Manager, Admin Settings, field definitions, forms, picklists, permissions, existing actions, record print templates and business data were not modified.
- No database migration, data cleanup, record deletion, or production test-record creation was performed.
- Forbidden teacher student fields and removed Homework/Work Log metadata fields cannot be used through this filter catalog. Existing server authorization remains authoritative; personal hiding is not security.
- Students now read all authorized API pages matching existing quick filters before applying personal filters. Core reference lists no longer stop silently at 500; school/teacher scope remains intact.
- Personal advanced conditions run in the browser over authorized results, not as SQL filters. For very large schools, server-side filtering/pagination is a future performance improvement.

## Explicitly not included

- Local-mode personalization; Local functionality is unchanged.
- Specialized Attendance, Calendar, Timetable and Exam entry grids, and other workspaces outside the nine lists above. These need their own adapters rather than generic manipulation of interactive grids.
- Named/shared views, cross-device synchronization, nested condition groups, custom fields not already present in the table, and personal editing of field definitions.

## Focused verification

- TypeScript build: PASS.
- `tests/unit/personal-views.test.ts`: two tests PASS (AND/OR, sort, source immutability, school/user/workspace isolation, forbidden/removed fields, malformed preferences).
- `tests/integration/personal-view-sources.test.ts`: PASS (510 staff records, school isolation, teacher-only scope).
- `tests/personal-views-browser.ts`: PASS (all nine adapters, column hide/reorder after refresh, Actions preserved, record beyond student API page 100, Notice filtering before page 20, Cancel/Reset, two actual user accounts, workspace isolation, typed conditions, mobile bounds, print-toolbar exclusion, zero browser console errors).
- Desktop Columns and mobile Filter screenshots visually inspected in `output/personal-views-sanity`.
- Browser tests use isolated pg-mem data, not live school data. The test pre-initializes metadata serially because pg-mem does not provide PostgreSQL row locks. Existing SQL text search uses syntax unsupported by this test database; quick-filter combination was tested with Class instead. Text-search implementation was not changed.
- Full module regression was not run.

## Runtime

The built backend was restarted (PID 30032); `/health` returned OK. Both new frontend assets return HTTP 200, and CSS is served as `text/css`. Refresh the application to load the new controls.
