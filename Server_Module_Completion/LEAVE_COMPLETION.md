# Leave Requests completion — 2026-09-16

Deployed schema 28 / Workspace Manager factory 9. Refresh with Ctrl+F5.

## UI

| Check | Result |
|---|---|
| Reference UI followed with existing SchoolHub styles | PASS |
| Real summary counts | PASS |
| Applicant/type/status/date-range filters | PASS |
| Right-side Add/Edit drawer | PASS |
| View | PASS |
| Approve | PASS |
| Reject with decision note | PASS |
| Existing branded print engine | PASS |
| Non-destructive Archive | PASS |
| Mobile cards and full-width drawer | PASS |

Pending edits are allowed only before any review decision. Once review has started, or a request is Approved/Rejected, it is read-only. Initial status is Pending and cannot be supplied by the client to bypass approval. Multi-step approvals retain their pinned stages and assigned-role checks; approving an intermediate stage does not falsely mark the request Approved.

## Workspace Manager

Leave workspace registered: YES, key leave-requests.

| Field | Type |
|---|---|
| Applicant Type | singleSelect |
| Student Applicant / Staff Applicant | workspaceReference, conditionally selected by Applicant Type |
| Applicant Name Snapshot | read-only text, historical compatibility only |
| Leave Type | singleSelect |
| From Date / To Date | date |
| Reason | longText |
| Status | singleSelect, workflow controlled |
| Decision Note | longText, decision controlled |
| Priority | singleSelect |
| Attachment | file |
| Submitted By / Decision By | workspaceReference to users |
| Submitted At / Decision At / Created At / Updated At | dateTime |

The existing Workspace Manager uses fixed-target references, so this implementation uses two genuine references (studentId and staffId), not a fake polymorphic field or a name Picklist. The operational drawer presents one Applicant selector with the corresponding source.

## Picklists

Applicant Type: PASS — leaveApplicantType: Student, Staff.
Leave Type: PASS — leaveType: Sick Leave, Medical Appointment, Family Function, Personal Leave, Emergency Leave, Official Duty, Other. Existing loaded historical type labels are added non-destructively if absent; configured options are not overwritten.
Leave Status: PASS — leaveStatus: Pending, Approved, Rejected. Existing stored codes retained.
Priority: PASS — leavePriority: Normal, High, Urgent.

Student source: existing students table / Students workspace, stable studentId.
Staff source: existing staff table / Teachers & Staff workspace, stable staffId.
References are validated for the current school and active record status. Teacher applicant selection retains existing teacher/student scope checks.

## System and storage

Existing decisionNote compatibility preserved: YES.
Permissions preserved: YES — existing leave:view/create/update/delete/print plus approval-stage role checks.
Audit preserved: YES — create/update/decision/archive events; workflow history retained.
Authority model preserved: YES — existing PostgreSQL server authority. No browser persistence fallback.
Console/API errors: PASS in isolated happy-path browser tests; expected validation/conflict failures verified separately.

Exact existing table: school_leave_requests(id text PK, school_id text FK schools, data jsonb, archived boolean, version integer, created_at timestamptz, updated_at timestamptz).
Existing JSON keys remain applicant, type, from, to, reason, status, decisionNote.
New records add applicantType, studentId or staffId (other null), priority, submittedBy, submittedByName, submittedAt. Final decisions add decisionBy, decisionByName, decisionAt.
Names are resolved from current master records when linked; applicant preserves a name snapshot. Old name-only records are not guessed or linked by name, and missing historical identity fields are shown as Not recorded. Existing workflow history provides available historical submitter/decision names and dates.
Duration is calculated inclusively from dates and is not duplicated in storage.

New migration 28 adds leave_files(id text PK, school_id text FK schools, leave_id text FK school_leave_requests, name text, type text, size integer, content text, archived boolean, created_at timestamptz) plus scope index.
Attachments genuinely supported: one PDF/JPG/PNG up to 5 MB, using existing file validation and base64 database storage; authenticated download, tenant checks, removal/retention and parent archive restrictions.
New endpoints: GET/POST /api/v1/leave-workspace, PATCH /api/v1/leave-workspace/:id, GET /api/v1/leave-files/:id.
Existing /api/v1/leaves/:id/decision and /remove retained. Approval now preserves its entered decisionNote and final decision user/time.

## Safety and verification

Build PASS. Two focused Leave integration suites PASS, including the existing multi-step workflow test. Isolated browser sanity PASS: create/edit/view, attachment, approval, rejection, print, archive, filters, mobile and zero console errors. No full module regression.
Live API health and Leave JavaScript checks PASS. Live authenticated browser testing was not performed.
Existing 152 leave requests and 192 workflow instances unchanged in count; all other monitored business counts unchanged. No temporary test records were written to the live database.
Verified backup: backups/schoolhub-before-leave-ui-2026-09-16T01-52-36-837Z.dump
SHA256: 8bcb2cc1873afed5d6f270ffb543f3f66373f05172cc21ab833cf77a0d590cd8
Screenshots: output/leave-sanity/drawer.png, desktop.png, mobile.png.

## Deliberately deferred

- No guessed migration of historical applicant names to Student/Staff IDs.
- No correction of finalized decisions, hard deletion, or new archive-restore workflow.
- Local-mode screens remain unchanged; this upgrade targets the existing server-backed Leave workspace.
- No redesign of the global shell, permissions, workflow settings, audit, backup, or unrelated modules.
