# Universal Workspace Manager implementation and audit

**Audit date:** 4 October 2026  
**Factory metadata version:** 21  
**Scope:** Students, Teachers & Staff, Classes, Attendance, Timetable, Homework, Teacher Work Log, Exams & Results, Fees & Payments, Leave Requests, Notices, Calendar & Holidays, Documents, Certificates & Forms, Uniform, Curriculum, Rules & Regulations, Transport, Assets, and ID Cards.

## Implemented universal rule

Every operational workspace uses the same five content tabs:

1. Dashboard
2. Main Tab
3. Grid Tab 1
4. Grid Tab 2
5. Grid Tab 3

A selected tab owns the existing workspace content area. Switching tabs does not append another content block.

Workspace Manager now controls these shared models:

| Control | Workspace Manager location | Stored as workspace metadata |
|---|---|---|
| Workspace identity, status and navigation | General | Yes |
| Main and Grid tab names | General / tab configuration | Yes |
| Sections and fields | Main Tab / Grid Tab 1–3 | Yes |
| Field type, order, width, visibility, validation and picklist reference | Main Tab / Grid Tab 1–3 | Yes |
| Form or document assigned to a tab | Main Tab / Grid Tab 1–3 | Yes |
| Dashboard metrics, charts, filters, tables, calendars, schedules and cards | Layout | Yes |
| Dashboard order, size, palette, aggregation, field source, rules and role visibility | Layout | Yes |
| Existing workspace action buttons | Action Buttons | Yes |
| Action label, tab, placement, style, order, visibility, role and permission key | Action Buttons | Yes |
| Action interaction, confirmation text, success text and refresh behavior | Action Buttons | Yes |
| Relationships | Relationships | Yes |
| Print layout and branding | Print & Branding | Yes |

An unconfigured dashboard stays empty. An unconfigured workspace action is hidden. The application no longer invents dashboard data or exposes a newly discovered workspace button by default.

## Existing action migration

The Action Buttons tab contains existing SchoolHub operations. It does not replace their business logic. Examples include Add, View, Edit, Print, Archive, Restore, Issue, Assign, Publish, Approve, Reject, Return, Revoke, maintenance actions, paging controls, filters, drawer launch actions, and drawer submit actions.

The manager owns how and where the action is presented. Existing server routes and client operation adapters still execute the action. This separation is required so an administrator cannot bypass validation, authorization, audit logging, record version checks, or transaction rules by editing a button.

Existing administrator action settings are preserved during factory synchronization. Version 21 merges missing factory action keys and fills missing Permission Overview assignments without replacing administrator-defined assignments.

## Workspace audit

Counts below are per school. Both local school datasets have matching version-20 metadata.

| Workspace | Dashboard components | Existing actions in Action Buttons | Sections / fields represented in metadata | Status |
|---|---:|---:|---:|---|
| Assets | 9 | 16 | 1 / 10 | Configured |
| Attendance | 7 | 11 | 1 / 5 | Configured |
| Calendar & Holidays | 4 | 20 | 1 / 25 | Configured |
| Certificates & Forms | 9 | 11 | 1 / 8 | Configured |
| Classes | 7 | 12 | 1 / 10 | Configured |
| Curriculum | 5 | 7 | 1 / 6 | Configured |
| Documents | 7 | 16 | 1 / 20 | Configured |
| Exams & Results | 19 | 32 | 3 / 16 | Configured |
| Fees & Payments | 13 | 22 | 2 / 16 | Configured |
| Homework | 8 | 21 | 3 / 15 | Configured |
| ID Cards | 7 | 13 | 1 / 8 | Configured |
| Leave Requests | 7 | 16 | 1 / 18 | Configured |
| Notices | 7 | 11 | 1 / 11 | Configured |
| Rules & Regulations | 3 | 3 | 1 / 1 | Configured |
| Students | 8 | 11 | 3–4 / 13–14 | Configured; one local custom field is preserved |
| Teacher Work Log | 8 | 19 | 1 / 20 | Configured |
| Teachers & Staff | 7 | 10 | 1 / 7 | Configured |
| Timetable | 10 | 8 | 2 / 19 | Configured |
| Transport | 7 | 16 | 2 / 18 | Configured |
| Uniform | 3 | 7 | 1 / 5 | Configured |

## Permission behavior

Every action now selects a controlled Permission Overview requirement and a permission source tab. Free-text permission keys are no longer accepted.

- View/open/navigation actions use VIEW.
- Create/add/issue actions use ADD.
- Edit/update actions use EDIT.
- Archive/delete/revoke actions use DELETE.
- Print actions use PRINT.
- Shared Save actions use contextual Add or Edit permission.
- Publish, approve, reject, assign, return, acknowledge, restore, and similar workflow actions use their corresponding special permission.
- Drawer Close and Cancel use VIEW so an authorized user cannot become trapped.

Action visibility is checked in two places:

- The workspace layout API removes actions whose tab capability, special permission, role, or visibility setting does not allow the signed-in user.
- The browser applies the same capability check before showing a configured action.

The underlying operation continues to enforce its existing server permission. Hiding, renaming, or moving a button does not grant permission to run it.

System Administrator is the universal backend authority. A signed-in principal marked systemRecovery receives every current and future workspace permission automatically, including all tab capabilities, special operations, and configured actions. This assignment is generated on the backend and does not depend on manually adding System Administrator to each action.

All other users and roles strictly follow Permission Overview. Permission to configure Workspace Manager only allows layout configuration; it does not grant operational View, Add, Edit, Delete, Print, or special-action access. An optional role restriction on an action can narrow access further, but cannot grant a missing Permission Overview capability.

## Forms and documents

Each Main or Grid tab has one content mode:

- Sections and fields
- One configured form
- One configured document

When a form or document is assigned, Add Section and Add Field are unavailable for that tab. Removing the assignment restores its sections-and-fields mode. A form is visible only after an administrator assigns it.

## Verified behavior

- Server TypeScript build passed.
- Server test suite passed: 47 tests across 5 files, including automatic full System Administrator authority.
- All 20 workspaces passed the universal five-tab browser regression.
- 103 tab interactions completed with no failures.
- Action editor browser verification passed:
  - Existing actions were listed.
  - An edited label was saved through the workspace layout API.
  - Existing row and drawer actions remained visible and usable when configured.
  - An unconfigured action was hidden.
- Both local school datasets were synchronized to factory version 22.
- All 564 stored action records across the two datasets have Permission Overview assignments; none are missing.
- Browser permission regression confirmed that ADD/RETURN-authorized actions remain visible while the same actions are hidden for a VIEW-only role.
- Browser permission regression confirmed that a Workspace Manager configurator does not inherit operational action access, while System Administrator sees every configured action even when the supplied action-access map is empty.
- Record-specific runtime buttons now resolve to stable Workspace Manager keys: Student View, Edit, Print, Archive/Delete, and Restore no longer include the record ID in their configuration identity.
- A rendered-control inventory across all 20 workspaces found zero unmapped action buttons after adding Student Admission Form, Fees Add Component, and Calendar navigation/view mappings.
- Database audit found 20 operational workspaces per school and 282 configured action definitions per school.

## Remaining hardcoded presentation found by the audit

The universal metadata layer now controls workspace tabs, sections, fields, forms/documents, dashboards, and action presentation. Some specialized operational renderers still contain fixed presentation text and fixed view structure:

- Native filter labels and the exact filter arrangement in several specialized Main views.
- Native table column headings and column order in specialized record tables.
- Empty-state and validation wording inside older operational modules.
- Some non-business safety controls outside operational workspaces, such as the application shell, authentication, Workspace Manager itself, and system administration dialogs.
- The implementation behind each operation remains code by design, because it performs validated server mutations and authorization checks.

These items are explicitly identified rather than being represented as editable when they are not.

## Recommended next universal extension

Add a **Views** configuration within each Main/Grid tab for specialized record views. It should store:

- Filter fields and order
- Table columns and order
- Sort and grouping defaults
- Empty-state title and description
- Row density
- Card/table/calendar view choice

This should reuse the existing workspace fields and permission model. It should not introduce workspace-specific switches. After that extension, specialized renderers can consume the same view metadata, which will remove the remaining fixed table/filter presentation while preserving their server-backed business operations.


## Universal Workspace Runtime toggle (Implementation Batch 1)

Frontend ownership of an operational workspace is now one of two mutually exclusive modes, resolved by the backend
(`schoolhub-server/src/services/workspace-runtime-mode.ts`) and delivered in `GET /api/v1/operational-workspaces`
(`runtimeMode`). Permissions are **not** governed by this toggle.

- `universal`: `universal-workspace-tabs.js` owns the tab bar, Dashboard, Main Tab, Grid Tabs 1-3, fields, standard actions,
  lifecycle and Grid Form dialogs. `workspace-layout.js` and the `workspace-actions.js` DOM overlay do nothing for the page.
- `legacy`: the previous native/legacy frontend owns the page, unchanged.
- Resolution: custom workspace → always `universal`; else `behavior_configuration.frontendRuntime` override; else the
  `UNIVERSAL_RUNTIME_WORKSPACES` allow-list (default `students,uniform`; `*` = all; empty = none); else `legacy`.
- A Main Tab is either generic Grid records, a registered `native-content` adapter (Students) or a `records` adapter
  (Uniform) via `schoolHubUniversalWorkspaces.registerMain`. Adapters supply domain content/operations only.
- Standard-action handlers are tab-aware: in a `universal` workspace a Grid tab never resolves a MAIN/workspace-wide handler.
- Workspace + tab → resource is explicit (`authorization/workspace-tab-resources.ts`), never manifest array position.
- Dashboard VIEW gates only the Dashboard components and Dashboard data feed.

Known remaining legacy debt: Exams and all other workspaces still use the legacy owner; no MAIN adapters other than
Students and Uniform; migrations 44, 45, 49 and 50 are unchanged (dummy Grid fields exist only for workspaces that existed
when migration 49/50 ran).
