# Documents workspace completion — 16 September 2026

Implemented and deployed in the existing SchoolHub application. Refresh the browser with Ctrl+F5.
Server mode uses the new Documents workspace; existing local-mode behavior is unchanged.

## UI

| Check | Result |
|---|---|
| Reference UI followed | PASS — existing SchoolHub styling, list-first layout |
| Filters | PASS — search, category, audience, status, Clear |
| Right-side drawer | PASS — shared Add/Edit, 500px desktop/full-width mobile |
| View | PASS — document details, human-readable targets, attachment downloads |
| Edit | PASS — existing values retained; optimistic version conflict protection |
| Print | PASS — existing printWindow/global school branding; internal remarks excluded |
| Archive/Delete | PASS — reversible archive only; confirmation; no hard deletion |
| Mobile | PASS — document cards and full-width drawer |

Archived records are available through the Archived status filter to editors. Super Admin can restore them as **Inactive**, retaining files and history. Review before making them Active again.
All Unarchived is the default filter. Drafts are visible only to their creator or users with document edit permission.

## Workspace Manager

Documents workspace registered: YES. Factory version: **11**.

| Field | Registered type |
|---|---|
| Document Name (`name`) | text, required |
| Category (`cat`) | singleSelect, required |
| Audience (`audiences`) | multiSelect, required |
| Description | longText |
| Tags | multiSelect with allowCustomValues / tags configuration; stored as string array |
| Version (`documentVersion`) | text; never auto-incremented |
| Effective Date | date |
| Expiry Date | date |
| Status | singleSelect, required |
| Requires Acknowledgement | boolean |
| Portal Visibility | boolean |
| Attachment (`attachments`) | file; maximum 5 files, 10 MB each |
| Internal Remarks | longText; requires documents:update to read/write |
| Created By | workspaceReference → users; read-only |
| Created At | dateTime; system/read-only |
| Updated At | dateTime; system/read-only |

Exact targeting references:
- `classId` → classes
- `sectionId` → sections, dependent on classId
- `studentId` → students
- `teacherId` → staff
- `createdBy` → users

Existing administrator labels and metadata are preserved; the operational UI reads field labels and detail-print visibility from Workspace Manager. Legacy `aud` and `date` field definitions remain for compatibility. This phase does not introduce a universal custom-field form renderer.

## Picklist Manager

| Picklist | Result |
|---|---|
| Document Category (`documentCategory`) | PASS |
| Document Status (`documentStatus`) | PASS |
| Document Audience Type (`documentAudience`) | PASS |

Categories: Admission, Consent, General, Finance, Transport, Health & Safety, Examination, Library, Policy, Circular, Other.
Statuses: Draft, Active, Archived, Inactive.
Audiences: All, Students, Parents, Teachers, Staff, Class, Section, Individual.
Existing categories and legacy audience values are added non-destructively to the lists; existing inactive/admin-defined values are not reset. Lifecycle statuses remain the four supported states.

Multiple audience selection: PASS. All cannot be combined with other audiences.
Workspace targeting: PASS — stable IDs, school validation, class/section matching and existing teacher scope; display names are resolved from master records, never copied into new master lists.
Targeting is configuration, not a newly implemented delivery/portal engine.

## Files

Real attachment storage: YES.
Uses the existing server/PostgreSQL base64 attachment pattern and shared validation; no external storage service or second upload engine.

Supported file types: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, WebP, TXT, CSV, PPT, PPTX.
Validation: server-side extension allowlist, canonical base64, safe filename, maximum 10 MB per file/5 files per document; existing PDF/image signature checks reused. This is not malware scanning or complete Office-file content verification.
Downloads require document view permission and school ownership; archived/draft access is restricted.
Replaced files are archived, not hard-deleted.

## System

| Check | Result |
|---|---|
| Permissions preserved | YES — existing documents:create/view/update/delete/print |
| Audit preserved | YES — append-only create/update/archive/restore events |
| Backup preserved | YES — verified pre-migration custom-format PostgreSQL backup |
| Console/API errors | PASS — zero unexpected errors in focused browser workflow |

Acknowledgement tracking: **deferred**. The boolean is stored; no counts or responses are fabricated.
Portal visibility: **future-only**. The preference is saved, but parent/student access is not opened. Internal remarks never appear in document-detail print output.
No new portal, notifications, automatic version-label increment, inline Office preview, or hard-delete feature was introduced.
No unrelated business modules were redesigned.

## Exact storage and migration

Existing table reused:
`school_content_records(id text PK, school_id text FK schools, kind text, record_key text, data jsonb, archived boolean, version integer, created_at timestamptz, updated_at timestamptz)`.
Documents continue using `kind='documents'`, with existing IDs and records retained.

Document JSON fields:
`name, cat, audiences:string[], description, tags:string[], documentVersion, effectiveDate:string|null, expiryDate:string|null, status, requiresAcknowledgement:boolean, portalVisible:boolean, internalRemarks, classId:string|null, sectionId:string|null, studentId:string|null, teacherId:string|null, createdBy:string|null, createdByName`.
Legacy `date` and unknown existing JSON keys are retained on edit. Legacy `aud` is preserved/read as one existing audience value; rich saves also maintain a compatibility joined string. New multi-audience values remain arrays, not comma-separated storage.
Missing legacy creator information is shown as Not recorded, not attributed to the editor.
The database `version` is concurrency control and is separate from the user-entered `documentVersion`.

Additive schema migration **30**, `document_workspace_files`:
`document_files(id text PK, school_id text FK schools, document_id text FK school_content_records, name text, type text, size integer, content text, archived boolean default false, created_at timestamptz)`.
Index: `document_files_scope_idx(school_id,document_id,archived)`.

API:
- GET/POST `/api/v1/document-workspace`
- PATCH `/api/v1/document-workspace/:id`
- POST `/api/v1/document-workspace/:id/archive`
- POST `/api/v1/document-workspace/:id/restore`
- GET `/api/v1/document-files/:id`

Legacy document reads redact internal remarks and hide unauthorized drafts. Legacy edits cannot overwrite enriched Documents records with the old four-field payload. Rules behavior remains unchanged.

## Verification and deployment

Passed:
- TypeScript build.
- Focused Documents integration test, including validation, concurrency, actual reader permission checks, file authorization, old-record preservation and archive/restore.
- Isolated browser sanity: list, drawer, add/edit/view, multi-audience, references, tags, file, print excluding private notes, filter, archive/restore, desktop/mobile and zero console errors.
- Light/dark screenshots inspected.
- Live service health and Documents asset availability.
- No full regression run. No live test documents created.

Screenshots: `output/documents-sanity/{drawer,list,dark,mobile}.png`.

Backup:
`backups/schoolhub-before-documents-ui-2026-09-16T02-41-04-890Z.dump`
Size: 2,198,216 bytes.
SHA-256: `d1c02e03f5465148f8fa6af9b75db80f9b65c58d4579f02294d01256c8fe489c`.
Verified with pg_restore --list before migration.

All compared business-table counts remained unchanged, including 31 school_content_records, 24 stored calendar records, 153 leave requests, 1,000 student rows and 50 staff rows. Existing archived/active states were not reset.
API restarted with schema 30.

