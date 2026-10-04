# Picklist Manager redesign and colors — 16 September 2026

Deployed. Refresh with Ctrl+F5.

**Workspace Manager is preserved.** Only its embedded Picklist editor was replaced by navigation to the standalone Picklist Manager. Workspace creation, fields, relationships, layouts, permissions, print settings and Picklist references remain available. A field's Picklist selector includes an Open Picklist Manager link.

## Requested checks

| Navigation | Result |
|---|---|
| Picklist Manager under Admin Settings → Data & System | PASS |
| Removed embedded Picklist editing from Workspace Manager | PASS — Workspace Manager itself retained |

| UI | Result |
|---|---|
| Reference UI followed | PASS — existing SchoolHub styling, list and right drawer |
| List-first layout | PASS |
| Right-side drawer | PASS |
| Separate value rows | PASS |
| Mobile | PASS — cards, stacked value rows, full-width drawer |

| Values | Result |
|---|---|
| Add Value | PASS |
| Edit label/color/filter value | PASS |
| Deactivate optional Value | PASS |
| Delete Safety | PASS — persisted choices are never hard-deleted |
| Reorder | PASS — Move Up/Down updates sort_order, not historical records |

| Colors | Result |
|---|---|
| Admin color selection | PASS — seven presets and custom color picker |
| Preview | PASS — same shared renderer as workspace badges |
| Workspace badge color inheritance | PASS |

| Workspace Reference | Result |
|---|---|
| Workspace-backed Picklists | PASS — existing Students, Teachers & Staff and Classes adapters |
| Manual Picklists | PASS |
| System Picklists protected | PASS |

| Compatibility | Result |
|---|---|
| Existing stable keys preserved | YES |
| Historical values preserved | YES |
| Attendance integration | PASS — browser verified Present changed to purple in real Attendance control |
| Leave integration | PASS — status options carry colors; shared badge renderer |
| Calendar integration | PASS — event-type colors drive calendar event chips |
| Documents integration | PASS — status options carry colors; shared badge renderer |

Homework, Notice Board and Classes status badges also use the shared renderer. Student status badges consume the central display metadata. Calendar colors use Calendar Event Type; holiday markings and inactive visual distinction remain.
Color changes are loaded when the workspace is opened/refreshed; this phase does not add multi-device push notifications.

| System | Result |
|---|---|
| Permissions preserved | YES — existing workspaces:view/configure checks |
| Backup preserved | YES |
| Console/API errors | PASS — zero unexpected errors in focused browser flow |

No full regression was run. Integration PASS above is scoped to Picklist data/color consumption, not full revalidation of each business module.

## Ownership and behavior

- Main page: search, source filter, Clear, stable keys, value counts, updated timestamps and Edit/View.
- Source types displayed: Admin-defined, System, Workspace Reference.
- Only built-ins can be System; administrators cannot create a fake system-owned list.
- Stable keys and existing stored value codes cannot be renamed.
- Value rows retain their database IDs on update.
- Missing optional values in older update payloads are retained as inactive, not deleted.
- Required canonical values cannot be omitted or deactivated.
- Inactive choices are hidden from new selections. Attendance returns allValues for historical labels; generic operational record/print definitions retain historical choices.
- Historical record values are not rewritten when labels, colors or order change.
- Workspace-source choices are read live, not copied into manual values.
- New workspace-backed choices store record IDs. Existing source mappings remain immutable and readable.
- Source preview is read-only and limited to the existing 1,000-record adapter limit.
- Usage Preview explicitly uses illustrative Sample rows, not actual student records.
- Colors are validated server-side; arbitrary CSS is rejected.

## Exact schemas

Existing `picklist_definitions` retained:
- `id text PRIMARY KEY`
- `school_id text REFERENCES schools(id)`
- `picklist_key text`, unique with school_id
- `name text`, `description text`
- `source_type text`: AdminDefined or Workspace (unchanged database enum/check)
- `workspace_id text REFERENCES workspace_definitions(id)`
- `value_field_key text`, `label_field_key text`, `filter_field_key text`
- `active boolean`, `version integer`
- `created_by text REFERENCES users(id)`
- `created_at timestamptz`, `updated_at timestamptz`
- NEW `is_system boolean NOT NULL DEFAULT false`

The API displays `sourceType: System` when is_system=true, preserving the underlying AdminDefined storage for old consumers.

Existing `picklist_values` retained:
- `id text PRIMARY KEY`
- `school_id text REFERENCES schools(id)`
- `picklist_id text REFERENCES picklist_definitions(id)`
- `value text`, unique within picklist_id
- `label text`, `filter_value text`
- `sort_order integer`, `active boolean`, `version integer`
- `created_at timestamptz`, `updated_at timestamptz`
- NEW `color text NOT NULL DEFAULT 'gray'`

Color values: green, red, amber, blue, purple, gray, teal, or validated six-digit #RRGGBB.
The shared `picklist-display.js` maps presets to colors and chooses black/white text for contrast. Module badges no longer need separate color decisions.
Migration **31: picklist_colors_and_system_protection** adds the two properties and initializes semantic defaults without changing stored codes or IDs.
Workspace factory stays **11**; deployment reported **0 created / 0 upgraded** Workspace definitions.

## Protected system Picklists

- attendanceStatus: Present, Absent, Late
- studentStatus: Active, Inactive, Archived
- leaveStatus: Pending, Approved, Rejected
- homeworkStatus: Draft, Published, Inactive
- homeworkAcknowledgementStatus: ASSIGNED, SEEN, IN_PROGRESS, COMPLETED, NEED_HELP
- calendarStatus: Active, Inactive, Cancelled
- documentStatus: Draft, Active, Archived, Inactive
- noticeStatus: Draft, Published, Inactive
- classStatus: Active, Inactive
- workLogStatus: Draft, Saved

These lists cannot be archived. Required values remain active and retain their codes. Labels, colors and order remain editable. Additional optional values may be deactivated.

## Textarea compatibility

The old pipe-delimited textarea was only an editor presentation. Values were already stored as separate database rows, so no text parsing/data migration was needed.
The old editor was replaced with structured rows. Existing stable keys, codes, IDs, labels, filter values, active states and order were retained. Existing legacy Workspace inline options are not silently converted or removed.

## Verification

Passed:
- TypeScript build.
- Three focused API tests across picklists.test.ts and picklist-colors.test.ts.
- Stable value IDs/order, invalid colors, canonical protection, retained omitted values, inactive selections, historical labels, stale versions and shared module color options.
- Existing Workspace-backed preview and Workspace field Picklist references.
- Isolated browser: separate settings navigation, Workspace Manager still present, row editing, saved color reflected in Attendance, add/deactivate optional value, historical label, field selector, mobile and zero console errors.
- Desktop/mobile visual review; no horizontal drawer overflow.
- Live /health: OK; both new JavaScript assets: HTTP 200.

Test records and purple test color were confined to the isolated test database.

## Backup and preservation

Verified backup:
`backups/schoolhub-before-picklists-ui-2026-09-16T03-17-20-488Z.dump`
Size: 2,219,011 bytes.
SHA-256: `124f66bdc2a53b26138195186aed962126e5cab919c125984e809f6d10ee01d0`.
Validated with pg_restore --list before migration.

All **21 existing definitions** retained their IDs and stable keys.
All **121 existing value rows** retained their IDs, owning Picklists and stored values.
All compared business table counts remained unchanged.
Workspace Manager was not removed or reset.

## Deliberately not included

- Hard deletion of persisted values: deactivation is used instead, even for apparently unused values, to protect legacy references.
- Arbitrary new workspace adapters beyond the three existing supported sources.
- Renaming stored codes, changing existing source mappings, or automatic historical record migration.
- Drag-and-drop ordering (Up/Down is implemented).
- Changes to local-browser Picklist storage or a separate local Picklist system.
- Full regression or unrelated module redesign.

