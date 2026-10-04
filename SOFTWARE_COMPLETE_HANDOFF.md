# SchoolHub Complete Software Handoff

**Repository audit date:** 2026-10-04  
**Evidence basis:** current checked-out frontend HTML/scripts, TypeScript backend routes/services, migration definitions, workspace factory v22, action factory, and authorization registry.  
**Scope:** all 22 authoritative sidebar modules plus additional built-in workspaces discovered in code.

## How to read this audit

“Factory field” means a field declared by the Workspace Manager factory. A native page can still render operational controls from its route code. The audit separates those two sources. “Five tabs” means the client Dashboard plus the four universal workspace tabs; the backend universal permission model itself contains MAIN, GRID_1, GRID_2 and GRID_3, while Dashboard is a configured visualization surface. API totals count the literal route declarations associated with the module using the route inventory in `schoolhub-audit-data.json`.

The universal model is configured in `schoolhub-server/src/services/workspace-service.ts`, `schoolhub-server/src/authorization/universal-workspace-permissions.ts`, `schoolhub-server/src/authorization/policy-registry.ts`, `schoolhub-server/src/factories/workspace-actions.json`, `Server_Module_Completion/workspace-layout.js`, `Server_Module_Completion/workspace-actions.js`, and `Server_Module_Completion/workspace-dashboard.js`. Definitions, sections, fields, roles, grants, tabs, dashboard layout and generic grid records are database-backed. Native domain tables and specialist workflows remain code-backed and are exposed to Workspace Manager through action/layout metadata rather than generated from fields alone.

## Verified final inventory

| Module | Fields | Tabs | Grids | APIs | Permissions | DB Models | Admin Configurations |
|---|---:|---:|---:|---:|---:|---:|---:|
| Dashboard | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| Students | 13 | 5 | 3 | 14 | 22 | 5 | 8 |
| Teachers & Staff | 7 | 5 | 3 | 12 | 44 | 3 | 8 |
| Classes & Sections | 10 | 5 | 3 | 20 | 22 | 4 | 8 |
| Attendance | 5 | 5 | 3 | 5 | 23 | 4 | 8 |
| Time Table | 19 | 5 | 3 | 11 | 45 | 7 | 8 |
| Homework | 15 | 5 | 3 | 12 | 51 | 3 | 8 |
| Teacher Work Log | 20 | 5 | 3 | 2 | 27 | 4 | 8 |
| Exams & Results | 16 | 5 | 3 | 28 | 74 | 9 | 8 |
| Fees & Payments | 16 | 5 | 3 | 10 | 89 | 2 | 8 |
| Leave Requests | 18 | 5 | 3 | 6 | 27 | 2 | 8 |
| Notice Board | 11 | 5 | 3 | 19 | 28 | 5 | 8 |
| Calendar & Holidays | 25 | 5 | 3 | 7 | 27 | 2 | 8 |
| Documents | 20 | 5 | 3 | 0 | 28 | 2 | 8 |
| Certificates & Forms | 8 | 5 | 3 | 4 | 27 | 1 | 8 |
| Uniform | 5 | 5 | 3 | 6 | 27 | 2 | 8 |
| Curriculum | 6 | 5 | 3 | 6 | 27 | 2 | 8 |
| Rules & Regulations | 1 | 5 | 3 | 6 | 27 | 2 | 8 |
| Transport | 18 | 5 | 3 | 6 | 27 | 2 | 8 |
| Assets | 10 | 5 | 3 | 16 | 89 | 5 | 8 |
| ID Cards | 8 | 5 | 3 | 17 | 45 | 4 | 8 |
| Admin Settings | 0 | 0 | 0 | 70 | 4 | 18 | 16 |

Inventory caveat: Dashboard is a navigation page rather than a `workspace_definitions` record. Admin Settings is a configuration shell rather than an operational record workspace, so field/tab/grid counts are zero by design. Permission counts for operational modules are unique resource/action contracts in the current authorization manifest, not the number of checkboxes shown to one role.

## 1. Dashboard

| Item | Details |
|---|---|
| Workspace | Dashboard (overview page; not a workspace definition) |
| Sidebar | Overview |
| Frontend | `SchoolHub_School_Management_App_Complete.html` overview page and Dashboard Defaults admin page |
| Backend | Aggregated domain APIs; no dedicated Dashboard CRUD route was found |
| Database | Reads other modules; school/dashboard preferences are held in school settings/configuration |
| Admin configurable | Partial: Dashboard Defaults and appearance settings; it is outside the 20 operational Workspace Manager keys |

Purpose: provide a school-wide summary and navigation overview. It does not use the operational `Dashboard → Main → Grid 1 → Grid 2 → Grid 3` contract and has no factory fields, forms, record grid, archive or permanent-delete behavior of its own. Its cards depend on source modules and inherit their authorization. A safe implementation must keep aggregation permission-aware so a role cannot infer counts for records it cannot view. Audit events arise in the source operations, not from reading the Dashboard.

Known limitation: the top-level Dashboard is not fully governed by Workspace Manager. This is an intentional architectural exception in the current code, and changing it requires a product decision because it is a global landing surface rather than a record workspace.

## 2. Students

| Item | Details |
|---|---|
| Workspace | Students (key: `students`) |
| Sidebar location | Academics |
| Purpose | Student identity, enrolment, guardianship and academic placement. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 13 factory fields in 3 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 22 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | students, student_academic_history, guardian_profiles, guardian_student_links, users |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-students) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/academic.ts, schoolhub-server/src/routes/api.ts |

### Tabs, sections and rendering

Factory sections: `basic_information` (5 fields), `academic_information` (4 fields), `parent_information` (4 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| basic_information | admissionNumber | Admission Number | text | Yes | Yes | Yes | Not declared in factory metadata |
| basic_information | name | Student Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| basic_information | rollNumber | Roll Number | text | No | Yes | No | Not declared in factory metadata |
| basic_information | dateOfBirth | Date of Birth | date | No | No | No | Not declared in factory metadata |
| basic_information | gender | Gender | text | No | No | No | filterable=true |
| academic_information | classId | Class | workspaceReference | Yes | No | No | filterable=true |
| academic_information | sectionId | Section | text | No | No | No | filterable=true |
| academic_information | academicYearId | Academic Year | text | Yes | No | No | filterable=true |
| academic_information | status | Status | text | Yes | No | No | filterable=true |
| parent_information | fatherName | Father / Guardian | text | No | Yes | No | Not declared in factory metadata |
| parent_information | email | Email | email | No | No | No | Not declared in factory metadata |
| parent_information | phone | Phone | phone | No | No | No | Not declared in factory metadata |
| parent_information | address | Address | longText | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Student | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| + Add Student | MAIN | workspaceHeader | open-student | MAIN:ADD | direct | Yes |
| Promote Students | MAIN | workspaceHeader | open-promotion-panel | MAIN:EDIT | direct | Yes |
| Clear Filters | MAIN | sectionHeader | clear-student-filters | MAIN:VIEW | direct | Yes |
| ✕ | MAIN | sectionHeader | close-student-drawer | MAIN:VIEW | direct | Yes |
| Save Student | MAIN | workspaceHeader | save-student | MAIN:INHERIT | direct | Yes |
| + Admission Form | MAIN | workspaceHeader | admission-form | MAIN:ADD | drawer | Yes |
| Admission Form | MAIN | row | open-admission-form | MAIN:VIEW | drawer | Yes |

Backend resources: `student` (22 actions; scopes SELF, CHILD_PERSONAL, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_STUDENT, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (14):

- `POST /api/v1/academic/promotions/preview` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/promotions/commit` — `schoolhub-server/src/routes/academic.ts`
- `GET /api/v1/students` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/students/:id` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/students` — `schoolhub-server/src/routes/api.ts`
- `PATCH /api/v1/students/:id` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/students/:id/deactivate` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/students/:id/restore` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/students/:id/print-event` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/guardians/:id/students` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/exam-workspace/students` — `schoolhub-server/src/routes/exam-workspace.ts`
- `GET /api/v1/operational-workspaces/students/tabs/:tabKey/records` — `schoolhub-server/src/routes/operational-workspaces.ts`
- `PATCH /api/v1/operational-workspaces/students/tabs/:tabKey/records/:recordId` — `schoolhub-server/src/routes/operational-workspaces.ts`
- `GET /api/v1/operational-workspaces/students/records/:recordId` — `schoolhub-server/src/routes/operational-workspaces.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| classes | class_id | Required placement; class deletion is restricted by FK. |
| sections | section_id | Optional placement; section updates affect display. |
| academic_years | academic_year_id | Optional/current enrolment context. |
| guardian_student_links | student_id | Guardian access and child scope. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 3. Teachers & Staff

| Item | Details |
|---|---|
| Workspace | Teachers & Staff (key: `staff`) |
| Sidebar location | Academics |
| Purpose | Staff identity, employment state and teaching assignments. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 7 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 44 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | staff, teacher_assignments, users |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-staff) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/academic.ts, schoolhub-server/src/routes/api.ts |

### Tabs, sections and rendering

Factory sections: `basic_information` (7 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| basic_information | employeeNumber | Employee Number | text | No | Yes | Yes | Not declared in factory metadata |
| basic_information | name | Staff Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| basic_information | role | Role | text | Yes | No | No | filterable=true |
| basic_information | subjectSnapshot | Subject | text | No | No | No | filterable=true |
| basic_information | phone | Phone | phone | No | No | No | Not declared in factory metadata |
| basic_information | email | Email | email | No | No | No | Not declared in factory metadata |
| basic_information | status | Status | text | Yes | No | No | filterable=true |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Staff Member | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| + Add Teacher / Staff | MAIN | workspaceHeader | open-teacher-drawer-add | MAIN:ADD | direct | Yes |
| Clear Filters | MAIN | sectionHeader | clear-teacher-filters | MAIN:VIEW | direct | Yes |
| ✕ | MAIN | sectionHeader | close-teacher-drawer | MAIN:VIEW | direct | Yes |
| Save | MAIN | workspaceHeader | save-teacher | MAIN:INHERIT | direct | Yes |

Backend resources: `staff` (22 actions; scopes SELF, ALL_WORKSPACE); `teaching-assignment` (22 actions; scopes SELF, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (12):

- `GET /api/v1/staff` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/staff` — `schoolhub-server/src/routes/api.ts`
- `PATCH /api/v1/staff/:id` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/staff/:id/deactivate` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/staff/:id/restore` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/staff/:id/print-event` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/teacher-assignments` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/teacher-assignments` — `schoolhub-server/src/routes/api.ts`
- `PATCH /api/v1/teacher-assignments/:id` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/teacher-assignments/:id/deactivate` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/teacher-assignments/:id/restore` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/operational-workspaces/staff/records/:recordId` — `schoolhub-server/src/routes/operational-workspaces.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| teacher_assignments | teacher_id | Teaching context drives scoped access. |
| users | teacher_id | Optional login identity. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 4. Classes & Sections

| Item | Details |
|---|---|
| Workspace | Classes & Sections (key: `classes`) |
| Sidebar location | Academics |
| Purpose | Class, section and subject organization. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 10 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 22 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | classes, sections, subjects, teacher_assignments |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-classes) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/academic.ts, schoolhub-server/src/routes/api.ts |

### Tabs, sections and rendering

Factory sections: `class_details` (10 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| class_details | name | Class Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| class_details | sections | Sections | workspaceReference | Yes | No | No | Not declared in factory metadata |
| class_details | classTeacherId | Class Teacher | workspaceReference | No | No | No | Not declared in factory metadata |
| class_details | active | Active | boolean | Yes | No | No | Not declared in factory metadata |
| class_details | status | Status | singleSelect | Yes | No | No | filterable=true |
| class_details | studentCount | Students | integer | No | No | No | Not declared in factory metadata |
| class_details | createdAt | Created At | dateTime | No | No | No | Not declared in factory metadata |
| class_details | updatedAt | Updated At | dateTime | No | No | No | Not declared in factory metadata |
| class_details | room | Room | text | No | No | No | Not declared in factory metadata |
| class_details | academicGroup | Academic Level / Group | text | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Class | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| + Add Class | MAIN | workspaceHeader | add-class | MAIN:ADD | direct | Yes |
| Clear Filters | MAIN | sectionHeader | clear-class-filters | MAIN:VIEW | direct | Yes |
| Add Class | MAIN | workspaceHeader | classes-open | MAIN:ADD | drawer | Yes |
| Save Class | MAIN | sectionHeader | classes-submit | MAIN:INHERIT | direct | Yes |
| Close | MAIN | sectionHeader | drawer-close | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | drawer-cancel | MAIN:VIEW | direct | Yes |

Backend resources: `class` (22 actions; scopes ASSIGNED_CLASS, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (20):

- `GET /api/v1/classes` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/classes` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/classes/bundle` — `schoolhub-server/src/routes/api.ts`
- `PATCH /api/v1/classes/:id` — `schoolhub-server/src/routes/api.ts`
- `PATCH /api/v1/classes/:id/bundle` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/classes/:id/deactivate` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/classes/:id/restore` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/sections` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/sections` — `schoolhub-server/src/routes/api.ts`
- `PATCH /api/v1/sections/:id` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/sections/reorder` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/sections/:id/deactivate` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/sections/:id/restore` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/subjects` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/subjects` — `schoolhub-server/src/routes/api.ts`
- `PATCH /api/v1/subjects/:id` — `schoolhub-server/src/routes/api.ts`
- `POST /api/v1/subjects/:id/deactivate` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/standard-workspaces/classes` — `schoolhub-server/src/routes/standard-workspaces.ts`
- `POST /api/v1/standard-workspaces/classes/:id/archive` — `schoolhub-server/src/routes/standard-workspaces.ts`
- `POST /api/v1/workspaces/:id/sections` — `schoolhub-server/src/routes/workspaces.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| sections | class_id | Required parent-child relationship. |
| teacher_assignments | class_id | Assignments depend on class. |
| students | class_id | Student placement prevents unsafe delete. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 5. Attendance

| Item | Details |
|---|---|
| Workspace | Attendance (key: `attendance`) |
| Sidebar location | Academics |
| Purpose | Student attendance capture and correction by date and period. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 5 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 23 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | attendance_records, students, school_periods, timetable_entries |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-attendance) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/academic.ts, schoolhub-server/src/routes/api.ts |

### Tabs, sections and rendering

Factory sections: `attendance_details` (5 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| attendance_details | attendanceDate | Date | date | Yes | No | Yes | filterable=true |
| attendance_details | period | Session | text | Yes | No | No | filterable=true |
| attendance_details | studentId | Student | workspaceReference | Yes | Yes | No | Not declared in factory metadata |
| attendance_details | status | Status | text | Yes | No | No | filterable=true |
| attendance_details | remark | Remark | longText | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Mark Attendance | MAIN | workspaceHeader | mark | MAIN:EDIT | direct | Yes |
| Save | MAIN | workspaceHeader | save | MAIN:INHERIT | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Clear Filters | MAIN | workspaceHeader | clear | MAIN:VIEW | direct | Yes |
| Mark All Present | MAIN | sectionHeader | mark-all-present | MAIN:EDIT | direct | Yes |
| All | MAIN | sectionHeader | set-attendance-quick-filter | MAIN:VIEW | direct | Yes |
| Unmarked | MAIN | sectionHeader | set-attendance-quick-filter-unmarked | MAIN:VIEW | direct | Yes |
| Present | MAIN | sectionHeader | set-attendance-quick-filter-present | MAIN:VIEW | direct | Yes |
| Absent | MAIN | sectionHeader | set-attendance-quick-filter-absent | MAIN:VIEW | direct | Yes |
| Late | MAIN | sectionHeader | set-attendance-quick-filter-late | MAIN:VIEW | direct | Yes |

Backend resources: `attendance-entry` (23 actions; scopes SELF, CHILD_PERSONAL, ASSIGNED_SECTION, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (5):

- `GET /api/v1/academic/attendance-options` — `schoolhub-server/src/routes/academic.ts`
- `GET /api/v1/academic/attendance` — `schoolhub-server/src/routes/academic.ts`
- `PUT /api/v1/academic/attendance` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/attendance/print-event` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/portal/teacher/attendance` — `schoolhub-server/src/routes/api.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| students | student_id | Required attendee. |
| school_periods | period_key | Period context is textual/key based. |
| timetable_entries | class/section/period | Contextual relationship, not a direct attendance FK. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 6. Time Table

| Item | Details |
|---|---|
| Workspace | Time Table (key: `timetable`) |
| Sidebar location | Academics |
| Purpose | Period definitions and class/teacher scheduling. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 19 factory fields in 2 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 45 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | timetable_entries, school_periods, academic_years, classes, sections, subjects, staff |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-timetable) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/academic.ts, schoolhub-server/src/routes/api.ts |

### Tabs, sections and rendering

Factory sections: `slot_details` (12 fields), `period_structure` (7 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| slot_details | academicYearId | Academic Year | text | Yes | No | No | filterable=true |
| slot_details | classId | Class | workspaceReference | Yes | No | No | filterable=true |
| slot_details | sectionId | Section | text | No | No | No | filterable=true |
| slot_details | subjectId | Subject | text | Yes | No | No | filterable=true |
| slot_details | teacherId | Teacher | workspaceReference | Yes | No | No | filterable=true |
| slot_details | dayOfWeek | Day | text | Yes | No | No | filterable=true |
| slot_details | periodKey | Period | text | Yes | No | No | filterable=true |
| slot_details | room | Room | text | No | No | No | filterable=true |
| slot_details | notes | Notes | longText | No | No | No | Not declared in factory metadata |
| slot_details | startTime | Start Time | text | No | No | No | Not declared in factory metadata |
| slot_details | endTime | End Time | text | No | No | No | Not declared in factory metadata |
| slot_details | active | Active | boolean | Yes | No | No | filterable=true |
| period_structure | periodName | Period Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| period_structure | periodType | Period Type | text | Yes | No | No | filterable=true |
| period_structure | periodStartTime | Start Time | text | Yes | No | No | Not declared in factory metadata |
| period_structure | periodEndTime | End Time | text | Yes | No | No | Not declared in factory metadata |
| period_structure | durationMinutes | Duration (minutes) | integer | Yes | No | No | Not declared in factory metadata |
| period_structure | periodOrder | Display Order | integer | Yes | No | No | Not declared in factory metadata |
| period_structure | periodActive | Active | boolean | Yes | No | No | filterable=true |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| New Timetable Entry | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| + Add Period | MAIN | workspaceHeader | open-add-period | MAIN:ADD | direct | Yes |
| Save Changes | MAIN | workspaceHeader | save-timetable | MAIN:INHERIT | direct | Yes |

Backend resources: `timetable-entry` (23 actions; scopes CLASS, SECTION, ASSIGNED_TEACHING_CONTEXT, ALL_WORKSPACE); `timetable-period` (22 actions; scopes ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (11):

- `GET /api/v1/academic/timetable` — `schoolhub-server/src/routes/academic.ts`
- `GET /api/v1/academic/timetable-options` — `schoolhub-server/src/routes/academic.ts`
- `GET /api/v1/academic/timetable-periods` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/timetable-periods` — `schoolhub-server/src/routes/academic.ts`
- `PATCH /api/v1/academic/timetable-periods/:id` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/timetable-periods/:id/move` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/timetable-periods/:id/deactivate` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/timetable` — `schoolhub-server/src/routes/academic.ts`
- `PATCH /api/v1/academic/timetable/:id` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/timetable/:id/deactivate` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/timetable/print-event` — `schoolhub-server/src/routes/academic.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| academic_years | academic_year_id | Required. |
| classes | class_id | Required. |
| sections | section_id | Optional. |
| subjects | subject_id | Optional. |
| staff | teacher_id | Optional teacher. |
| school_periods | period_key | Period definition key. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 7. Homework

| Item | Details |
|---|---|
| Workspace | Homework (key: `homework`) |
| Sidebar location | Academics |
| Purpose | Assignment authoring, publishing, files and acknowledgements. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 15 factory fields in 3 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 51 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | homework_records, homework_files, homework_acknowledgements |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-homework) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/homework-workspace.ts, schoolhub-server/src/routes/api.ts |

### Tabs, sections and rendering

Factory sections: `class_assignment` (5 fields), `assignment_details` (6 fields), `system_information` (4 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| class_assignment | academicYearId | Academic Year | workspaceReference | Yes | No | No | filterable=true |
| class_assignment | classId | Class | workspaceReference | Yes | No | No | filterable=true |
| class_assignment | sectionId | Section | workspaceReference | Yes | No | No | filterable=true |
| class_assignment | subjectId | Subject | workspaceReference | Yes | No | No | filterable=true |
| class_assignment | teacherId | Teacher | workspaceReference | Yes | No | No | Not declared in factory metadata |
| assignment_details | title | Title | text | Yes | Yes | Yes | Not declared in factory metadata |
| assignment_details | instructions | Homework / Instructions | longText | Yes | No | No | Not declared in factory metadata |
| assignment_details | assignedDate | Assigned Date | date | Yes | No | No | filterable=true |
| assignment_details | dueDate | Due Date | date | Yes | No | No | filterable=true |
| assignment_details | status | Status | singleSelect | Yes | No | No | filterable=true |
| assignment_details | attachments | Attachments | file | No | No | No | Not declared in factory metadata |
| system_information | createdBy | Created By | workspaceReference | No | No | No | Not declared in factory metadata |
| system_information | createdAt | Created At | dateTime | No | No | No | Not declared in factory metadata |
| system_information | updatedAt | Updated At | dateTime | No | No | No | Not declared in factory metadata |
| system_information | acknowledgements | Student Acknowledgements | workspaceReference | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Homework | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Publish | MAIN | row | publish | MAIN:SPECIAL:PUBLISH | direct | Yes |
| Archive | MAIN | row | deactivate | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Acknowledgements | MAIN | workspaceHeader | ack | MAIN:SPECIAL:ACKNOWLEDGE | direct | Yes |
| Clear | MAIN | sectionHeader | clear | MAIN:VIEW | direct | Yes |
| Close | MAIN | sectionHeader | close | MAIN:VIEW | direct | Yes |
| File | MAIN | sectionHeader | file | MAIN:VIEW | direct | Yes |
| Next | MAIN | sectionHeader | next | MAIN:VIEW | direct | Yes |
| Previous | MAIN | sectionHeader | prev | MAIN:VIEW | direct | Yes |
| Try again | MAIN | sectionHeader | reload | MAIN:VIEW | direct | Yes |
| Save | MAIN | sectionHeader | save | MAIN:INHERIT | direct | Yes |
| Publish Homework | MAIN | sectionHeader | save-publish | MAIN:SPECIAL:PUBLISH | direct | Yes |
| View / Acknowledge | MAIN | sectionHeader | student-view | MAIN:SPECIAL:ACKNOWLEDGE | direct | Yes |
| Add Homework | MAIN | workspaceHeader | homework-open | MAIN:ADD | drawer | Yes |
| Publish Homework | MAIN | sectionHeader | homework-submit | MAIN:SPECIAL:PUBLISH | direct | Yes |
| Close | MAIN | sectionHeader | drawer-close | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | drawer-cancel | MAIN:VIEW | direct | Yes |

Backend resources: `homework` (28 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE); `homework-acknowledgement` (23 actions; scopes SELF, CHILD_PERSONAL, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (12):

- `GET /api/v1/academic/homework` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/homework` — `schoolhub-server/src/routes/academic.ts`
- `PATCH /api/v1/academic/homework/:id` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/homework/:id/publish` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/homework/:id/deactivate` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/portal/teacher/homework` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/homework-workspace` — `schoolhub-server/src/routes/homework-workspace.ts`
- `GET /api/v1/homework-workspace/definition` — `schoolhub-server/src/routes/homework-workspace.ts`
- `GET /api/v1/homework-workspace/:id` — `schoolhub-server/src/routes/homework-workspace.ts`
- `POST /api/v1/homework-workspace/:id/:action` — `schoolhub-server/src/routes/homework-workspace.ts`
- `PUT /api/v1/homework-workspace/:id/acknowledgement` — `schoolhub-server/src/routes/homework-workspace.ts`
- `GET /api/v1/homework-files/:id` — `schoolhub-server/src/routes/homework-workspace.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| classes | class_id | Required audience context. |
| sections | section_id | Optional audience. |
| subjects | subject_id | Optional subject. |
| staff | teacher_id | Optional author/teacher. |
| homework_files | homework_id | Cascade-style attachment lifecycle. |
| homework_acknowledgements | homework_id | Recipient acknowledgement. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 8. Teacher Work Log

| Item | Details |
|---|---|
| Workspace | Teacher Work Log (key: `teacher-work-log`) |
| Sidebar location | Academics |
| Purpose | Teacher delivery evidence linked to timetable and subjects. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 20 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 27 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | teacher_work_logs (referenced by routes; table may be introduced dynamically or under a different migration block), timetable_entries, staff, subjects |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-teacherlog) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/work-logs.ts, schoolhub-server/src/routes/work-log-workspace.ts |

### Tabs, sections and rendering

Factory sections: `work_log_details` (20 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| work_log_details | academicYear | Academic Year | workspaceReference | Yes | No | No | Not declared in factory metadata |
| work_log_details | date | Date | date | Yes | No | Yes | filterable=true |
| work_log_details | class | Class | workspaceReference | Yes | No | No | filterable=true |
| work_log_details | section | Section | workspaceReference | Yes | No | No | filterable=true |
| work_log_details | period | Period / Session | workspaceReference | Yes | No | No | Not declared in factory metadata |
| work_log_details | subject | Subject | workspaceReference | Yes | No | No | filterable=true |
| work_log_details | scheduledTeacherId | Scheduled Teacher | workspaceReference | Yes | No | No | Not declared in factory metadata |
| work_log_details | substitute | Substitute teacher taught this period | boolean | No | No | No | Not declared in factory metadata |
| work_log_details | teacherId | Actual Teacher | workspaceReference | Yes | No | No | filterable=true |
| work_log_details | substitutionReason | Substitution Reason | singleSelect | No | No | No | Not declared in factory metadata |
| work_log_details | topic | Topic / Lesson Taught | text | Yes | Yes | No | Not declared in factory metadata |
| work_log_details | details | Teaching Details / Class Work | longText | No | No | No | Not declared in factory metadata |
| work_log_details | homeworkGiven | Homework Given | longText | No | No | No | Not declared in factory metadata |
| work_log_details | remarks | Remarks | longText | No | No | No | Not declared in factory metadata |
| work_log_details | attachments | Attachments | file | No | No | No | Not declared in factory metadata |
| work_log_details | status | Status | singleSelect | Yes | No | No | Not declared in factory metadata |
| work_log_details | timetableEntryId | Timetable Context | workspaceReference | No | No | No | Not declared in factory metadata |
| work_log_details | createdBy | Created By | workspaceReference | No | No | No | Not declared in factory metadata |
| work_log_details | createdAt | Created At | dateTime | No | No | No | Not declared in factory metadata |
| work_log_details | updatedAt | Updated At | dateTime | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Work Log | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Save Draft | MAIN | workspaceHeader | draft | MAIN:INHERIT | direct | Yes |
| Archive | MAIN | row | remove | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Suggest From Timetable | MAIN | workspaceHeader | suggest | MAIN:VIEW | direct | Yes |
| Clear | MAIN | sectionHeader | clear | MAIN:VIEW | direct | Yes |
| Close | MAIN | sectionHeader | close | MAIN:VIEW | direct | Yes |
| File | MAIN | sectionHeader | file | MAIN:VIEW | direct | Yes |
| Next | MAIN | sectionHeader | next | MAIN:VIEW | direct | Yes |
| Previous | MAIN | sectionHeader | prev | MAIN:VIEW | direct | Yes |
| Try again | MAIN | sectionHeader | reload | MAIN:VIEW | direct | Yes |
| Save Work Log | MAIN | sectionHeader | save | MAIN:INHERIT | direct | Yes |
| Add Work Log | MAIN | workspaceHeader | teacherLog-open | MAIN:ADD | drawer | Yes |
| Save Work Log | MAIN | sectionHeader | teacherLog-submit | MAIN:INHERIT | direct | Yes |
| Close | MAIN | sectionHeader | drawer-close | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | drawer-cancel | MAIN:VIEW | direct | Yes |

Backend resources: `teacher-work-log` (27 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (2):

- `GET /api/v1/work-logs` — `schoolhub-server/src/routes/work-logs.ts`
- `POST /api/v1/work-logs/:id/remove` — `schoolhub-server/src/routes/work-logs.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| staff | teacher_id | Teacher ownership. |
| subjects | subject_id | Optional subject. |
| timetable_entries | timetable_entry_id | Optional schedule evidence. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 9. Exams & Results

| Item | Details |
|---|---|
| Workspace | Exams & Results (key: `exams-results`) |
| Sidebar location | Academics |
| Purpose | Assessments, marks, co-scholastic ratings and report-card output. |
| Total tabs | 5 visible: Dashboard, Assessments, Marks Entry, Report Cards, Co-scholastic |
| Total fields | 16 factory fields in 3 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 74 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | exam_records, mark_records, co_scholastic_evaluations, report_card_snapshots, exam_report_configuration, exam_logistics_sessions, exam_logistics_rooms, exam_logistics_seats, exam_logistics_invigilators |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-exams) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/exam-workspace.ts, schoolhub-server/src/routes/exam-logistics.ts, schoolhub-server/src/routes/api.ts |

### Tabs, sections and rendering

Factory sections: `exam_details` (9 fields), `result_details` (4 fields), `co_scholastic_details` (3 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| exam_details | name | Exam Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| exam_details | academicYearId | Academic Year | workspaceReference | Yes | No | No | filterable=true |
| exam_details | classId | Class | workspaceReference | Yes | No | No | filterable=true |
| exam_details | sectionId | Section | workspaceReference | No | No | No | filterable=true |
| exam_details | subjectId | Subject | workspaceReference | No | No | No | filterable=true |
| exam_details | examDate | Exam Date | date | No | No | No | filterable=true |
| exam_details | maxMarks | Maximum Marks | decimal | Yes | No | No | Not declared in factory metadata |
| exam_details | passingMarks | Passing Marks | decimal | No | No | No | Not declared in factory metadata |
| exam_details | state | Publication State | text | Yes | No | No | filterable=true |
| result_details | studentId | Student | workspaceReference | Yes | Yes | No | Not declared in factory metadata |
| result_details | marks | Marks | decimal | No | No | No | Not declared in factory metadata |
| result_details | absent | Absent | boolean | No | No | No | filterable=true |
| result_details | correctionReason | Correction Reason | longText | No | No | No | Not declared in factory metadata |
| co_scholastic_details | skillId | Skill | text | Yes | No | No | Not declared in factory metadata |
| co_scholastic_details | skillName | Skill Name | text | No | No | No | Not declared in factory metadata |
| co_scholastic_details | rating | Rating | text | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Create Assessment | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Marks Entry | MAIN | row | marks | MAIN:VIEW | drawer | Yes |
| Publish | MAIN | row | publish | MAIN:SPECIAL:PUBLISH | direct | Yes |
| Request Correction | MAIN | row | correct | MAIN:VIEW | direct | Yes |
| Print Assessment | MAIN | workspaceHeader | print-exam | MAIN:PRINT | print | Yes |
| Print Marks | MAIN | workspaceHeader | print-marks | MAIN:PRINT | print | Yes |
| Print Report Card | MAIN | workspaceHeader | print-report | MAIN:PRINT | print | Yes |
| Publish Report Cards | MAIN | workspaceHeader | publish-report | MAIN:SPECIAL:PUBLISH | direct | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Report Card Designer | MAIN | workspaceHeader | connect-designer | MAIN:VIEW | direct | Yes |
| Clear | MAIN | sectionHeader | clear | MAIN:VIEW | direct | Yes |
| Close | MAIN | sectionHeader | close | MAIN:VIEW | direct | Yes |
| Load Marks | MAIN | sectionHeader | load-marks | MAIN:EDIT | direct | Yes |
| Load Students | MAIN | sectionHeader | load-students | MAIN:EDIT | direct | Yes |
| Next | MAIN | sectionHeader | next | MAIN:VIEW | direct | Yes |
| Previous | MAIN | sectionHeader | prev | MAIN:VIEW | direct | Yes |
| Retry | MAIN | sectionHeader | reload | MAIN:VIEW | direct | Yes |
| Save Evaluations | MAIN | sectionHeader | save-co | MAIN:INHERIT | direct | Yes |
| Save Draft | MAIN | sectionHeader | save-exam | MAIN:INHERIT | direct | Yes |
| Save Marks | MAIN | sectionHeader | save-marks | MAIN:INHERIT | direct | Yes |
| Tab | MAIN | sectionHeader | tab | MAIN:VIEW | direct | Yes |
| Assessments | MAIN | sectionHeader | show-exam-tab-schedule | MAIN:VIEW | direct | Yes |
| Marks Entry | MAIN | sectionHeader | show-exam-tab-marks | MAIN:VIEW | direct | Yes |
| Report Cards | MAIN | sectionHeader | show-exam-tab-cards | MAIN:VIEW | direct | Yes |
| Co-Scholastic | MAIN | sectionHeader | show-exam-tab-coscholastic | MAIN:VIEW | direct | Yes |
| + Add Exam | MAIN | workspaceHeader | open-add-exam-modal | MAIN:ADD | direct | Yes |
| Clear Filters | MAIN | sectionHeader | clear-exam-filters | MAIN:VIEW | direct | Yes |
| View Report Card | MAIN | sectionHeader | view-report-card | MAIN:VIEW | direct | Yes |
| 🖶 Print Report Card | MAIN | sectionHeader | print-report-card-direct | MAIN:PRINT | print | Yes |

Backend resources: `exam` (24 actions; scopes CLASS, SECTION, ASSIGNED_TEACHING_CONTEXT, ALL_WORKSPACE); `mark` (25 actions; scopes SELF, CHILD_PERSONAL, ASSIGNED_TEACHING_CONTEXT, ALL_WORKSPACE); `report-card` (25 actions; scopes SELF, CHILD_PERSONAL, ASSIGNED_TEACHING_CONTEXT, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (28):

- `GET /api/v1/academic/exams` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/exams` — `schoolhub-server/src/routes/academic.ts`
- `PATCH /api/v1/academic/exams/:id` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/exams/:id/publish` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/exams/:id/correction` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/exams/:id/archive` — `schoolhub-server/src/routes/academic.ts`
- `PUT /api/v1/academic/marks` — `schoolhub-server/src/routes/academic.ts`
- `GET /api/v1/academic/report-cards/:studentId` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/academic/report-cards/:studentId/publish` — `schoolhub-server/src/routes/academic.ts`
- `POST /api/v1/portal/teacher/marks` — `schoolhub-server/src/routes/api.ts`
- `GET /api/v1/exam-logistics/configuration` — `schoolhub-server/src/routes/exam-logistics.ts`
- `PATCH /api/v1/exam-logistics/configuration` — `schoolhub-server/src/routes/exam-logistics.ts`
- `GET /api/v1/exam-logistics` — `schoolhub-server/src/routes/exam-logistics.ts`
- `POST /api/v1/exam-logistics/rooms` — `schoolhub-server/src/routes/exam-logistics.ts`
- `PATCH /api/v1/exam-logistics/rooms/:id` — `schoolhub-server/src/routes/exam-logistics.ts`
- `POST /api/v1/exam-logistics/sessions` — `schoolhub-server/src/routes/exam-logistics.ts`
- `POST /api/v1/exam-logistics/sessions/:id/allocate` — `schoolhub-server/src/routes/exam-logistics.ts`
- `PUT /api/v1/exam-logistics/sessions/:id/invigilators` — `schoolhub-server/src/routes/exam-logistics.ts`
- `POST /api/v1/exam-logistics/sessions/:id/publish` — `schoolhub-server/src/routes/exam-logistics.ts`
- `GET /api/v1/exam-logistics/sessions/:id/hall-tickets` — `schoolhub-server/src/routes/exam-logistics.ts`
- `GET /api/v1/exam-workspace/options` — `schoolhub-server/src/routes/exam-workspace.ts`
- `GET /api/v1/exam-workspace/students` — `schoolhub-server/src/routes/exam-workspace.ts`
- `GET /api/v1/exam-workspace/:id/marks` — `schoolhub-server/src/routes/exam-workspace.ts`
- `POST /api/v1/exam-workspace/:id/restore` — `schoolhub-server/src/routes/exam-workspace.ts`
- `GET /api/v1/exam-workspace/report-configuration` — `schoolhub-server/src/routes/exam-workspace.ts`
- `PUT /api/v1/exam-workspace/report-configuration` — `schoolhub-server/src/routes/exam-workspace.ts`
- `GET /api/v1/exam-workspace/co-scholastic` — `schoolhub-server/src/routes/exam-workspace.ts`
- `PUT /api/v1/exam-workspace/co-scholastic` — `schoolhub-server/src/routes/exam-workspace.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| exam_records | class_id/section_id/subject_id | Assessment context. |
| mark_records | exam_id/student_id | Required exam and student. |
| co_scholastic_evaluations | student_id | Student skill/rating. |
| report_card_snapshots | student_id/academic_year_id | Published immutable output. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 10. Fees & Payments

| Item | Details |
|---|---|
| Workspace | Fees & Payments (key: `fees-payments`) |
| Sidebar location | School Operations |
| Purpose | Student dues, payments, structures, assignments and corrections. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 16 factory fields in 2 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 89 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | fee_summaries, workspace_grid_records |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-fees) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/fees.ts, schoolhub-server/src/routes/api.ts |

### Tabs, sections and rendering

Factory sections: `payment_details` (7 fields), `ledger_dashboard` (9 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| payment_details | receipt | Receipt Number | text | Yes | Yes | Yes | Not declared in factory metadata |
| payment_details | date | Payment Date | date | Yes | No | No | filterable=true |
| payment_details | studentId | Student | workspaceReference | Yes | Yes | No | Not declared in factory metadata |
| payment_details | head | Fee Head | text | Yes | No | No | filterable=true |
| payment_details | mode | Payment Mode | text | Yes | No | No | filterable=true |
| payment_details | amount | Amount | currency | Yes | No | No | Not declared in factory metadata |
| payment_details | components | Fee Components | longText | No | No | No | Not declared in factory metadata |
| ledger_dashboard | studentName | Student Name | text | No | Yes | Yes | Not declared in factory metadata |
| ledger_dashboard | admission | Admission Number | text | No | Yes | No | Not declared in factory metadata |
| ledger_dashboard | className | Class | text | No | No | No | filterable=true |
| ledger_dashboard | sectionName | Section | text | No | No | No | filterable=true |
| ledger_dashboard | totalDue | Total Due | currency | No | No | No | Not declared in factory metadata |
| ledger_dashboard | totalPaid | Total Collected | currency | No | No | No | Not declared in factory metadata |
| ledger_dashboard | outstanding | Outstanding | currency | No | No | No | Not declared in factory metadata |
| ledger_dashboard | paymentStatus | Payment Status | text | No | No | No | filterable=true |
| ledger_dashboard | lastPaymentDate | Last Payment Date | date | No | No | No | filterable=true |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Record Fee Payment | MAIN | workspaceHeader | feePayment | MAIN:ADD | drawer | Yes |
| Assign Fee Structure | MAIN | workspaceHeader | feeAssignment | MAIN:SPECIAL:ASSIGN_RECORDS | drawer | Yes |
| Add Record | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Overview & Ledger | MAIN | sectionHeader | show-fee-tab-overview | MAIN:VIEW | direct | Yes |
| Payments & Receipts | MAIN | sectionHeader | show-fee-tab-payments | MAIN:VIEW | direct | Yes |
| Fee Structures | MAIN | sectionHeader | show-fee-tab-structures | MAIN:VIEW | direct | Yes |
| Assignments | MAIN | sectionHeader | show-fee-tab-assignments | MAIN:SPECIAL:ASSIGN_RECORDS | direct | Yes |
| Clear Filters | MAIN | sectionHeader | clear-ledger-filters | MAIN:VIEW | direct | Yes |
| Save Payment & Receipt | MAIN | workspaceHeader | save-fee | MAIN:INHERIT | direct | Yes |
| + Add Fee Structure | MAIN | workspaceHeader | open-add-fee-structure | MAIN:ADD | direct | Yes |
| Assign | MAIN | sectionHeader | assign-fee-structure-to-student | MAIN:SPECIAL:ASSIGN_RECORDS | direct | Yes |
| Record Fee Payment | MAIN | workspaceHeader | feePayment-open | MAIN:ADD | drawer | Yes |
| Save Payment & Receipt | MAIN | sectionHeader | feePayment-submit | MAIN:INHERIT | direct | Yes |
| Assign Fee Structure | MAIN | workspaceHeader | feeAssignment-open | MAIN:SPECIAL:ASSIGN_RECORDS | drawer | Yes |
| Assign | MAIN | sectionHeader | feeAssignment-submit | MAIN:SPECIAL:ASSIGN_RECORDS | direct | Yes |
| Close | MAIN | sectionHeader | drawer-close | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | drawer-cancel | MAIN:VIEW | direct | Yes |
| + Add Component | MAIN | sectionHeader | p5-add | MAIN:ADD | direct | Yes |

Backend resources: `fee-payment` (23 actions; scopes SELF, CHILD_PERSONAL, ALL_WORKSPACE); `fee-structure` (22 actions; scopes ALL_WORKSPACE); `fee-assignment` (22 actions; scopes SELF, CHILD_PERSONAL, ALL_WORKSPACE); `fee-correction` (22 actions; scopes ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (10):

- `POST /api/v1/fees/payments/:id/corrections` — `schoolhub-server/src/routes/fees.ts`
- `POST /api/v1/fees/corrections/:id/decision` — `schoolhub-server/src/routes/fees.ts`
- `GET /api/v1/fees` — `schoolhub-server/src/routes/fees.ts`
- `POST /api/v1/fees/assignments` — `schoolhub-server/src/routes/fees.ts`
- `POST /api/v1/fees/assignments/remove` — `schoolhub-server/src/routes/fees.ts`
- `POST /api/v1/fees/payments` — `schoolhub-server/src/routes/fees.ts`
- `POST /api/v1/fees/payments/:id/remove` — `schoolhub-server/src/routes/fees.ts`
- `POST /api/v1/fees/structures` — `schoolhub-server/src/routes/fees.ts`
- `PATCH /api/v1/fees/structures/:id` — `schoolhub-server/src/routes/fees.ts`
- `POST /api/v1/fees/structures/:id/remove` — `schoolhub-server/src/routes/fees.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| students | student_id | Required ledger owner. |
| academic_years | academic_year_id | Optional fee period. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 11. Leave Requests

| Item | Details |
|---|---|
| Workspace | Leave Requests (key: `leave-requests`) |
| Sidebar location | School Operations |
| Purpose | Student/staff leave submission, evidence and approval workflow. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 18 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 27 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | leave_requests (referenced by routes; table may be introduced dynamically or under a different migration block), leave_files |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-leave) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/leave-workspace.ts, schoolhub-server/src/routes/leave-workflows.ts |

### Tabs, sections and rendering

Factory sections: `leave_details` (18 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| leave_details | applicantType | Applicant Type | singleSelect | Yes | No | No | Not declared in factory metadata |
| leave_details | studentId | Student Applicant | workspaceReference | No | No | No | Not declared in factory metadata |
| leave_details | staffId | Staff Applicant | workspaceReference | No | No | No | Not declared in factory metadata |
| leave_details | applicant | Applicant Name Snapshot | text | No | Yes | Yes | Not declared in factory metadata |
| leave_details | type | Leave Type | singleSelect | Yes | No | No | filterable=true |
| leave_details | from | From Date | date | Yes | No | No | filterable=true |
| leave_details | to | To Date | date | Yes | No | No | filterable=true |
| leave_details | reason | Reason | longText | Yes | No | No | Not declared in factory metadata |
| leave_details | status | Status | singleSelect | Yes | No | No | filterable=true |
| leave_details | decisionNote | Decision Note | longText | No | No | No | Not declared in factory metadata |
| leave_details | priority | Priority | singleSelect | No | No | No | Not declared in factory metadata |
| leave_details | attachments | Attachment | file | No | No | No | Not declared in factory metadata |
| leave_details | submittedBy | Submitted By | workspaceReference | No | No | No | Not declared in factory metadata |
| leave_details | submittedAt | Submitted At | dateTime | No | No | No | Not declared in factory metadata |
| leave_details | decisionBy | Decision By | workspaceReference | No | No | No | Not declared in factory metadata |
| leave_details | decisionAt | Decision At | dateTime | No | No | No | Not declared in factory metadata |
| leave_details | createdAt | Created At | dateTime | No | No | No | Not declared in factory metadata |
| leave_details | updatedAt | Updated At | dateTime | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| New Leave Request | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Approve | MAIN | row | approve | MAIN:SPECIAL:APPROVE | direct | Yes |
| Reject | MAIN | row | reject | MAIN:SPECIAL:REJECT | confirm | Yes |
| Decision | MAIN | row | decision | MAIN:VIEW | drawer | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Download | MAIN | row | download | MAIN:VIEW | direct | Yes |
| Clear | MAIN | sectionHeader | clear | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | close | MAIN:VIEW | direct | Yes |
| Next | MAIN | sectionHeader | next | MAIN:VIEW | direct | Yes |
| Previous | MAIN | sectionHeader | prev | MAIN:VIEW | direct | Yes |
| Retry | MAIN | sectionHeader | reload | MAIN:VIEW | direct | Yes |
| Save | MAIN | sectionHeader | save | MAIN:INHERIT | direct | Yes |

Backend resources: `leave-request` (27 actions; scopes OWNED, CREATED_BY, SELF, CHILD_PERSONAL, DIRECT_ASSIGNED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (6):

- `GET /api/v1/leaves` — `schoolhub-server/src/routes/leave-workflows.ts`
- `POST /api/v1/leaves` — `schoolhub-server/src/routes/leave-workflows.ts`
- `POST /api/v1/leaves/:id/decision` — `schoolhub-server/src/routes/leave-workflows.ts`
- `POST /api/v1/leaves/:id/remove` — `schoolhub-server/src/routes/leave-workflows.ts`
- `GET /api/v1/leave-workspace` — `schoolhub-server/src/routes/leave-workspace.ts`
- `GET /api/v1/leave-files/:id` — `schoolhub-server/src/routes/leave-workspace.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| users/students/staff | applicant reference | Applicant context is validated by route/workflow. |
| leave_files | leave_request_id | Evidence attachment. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 12. Notice Board

| Item | Details |
|---|---|
| Workspace | Notice Board (key: `notices`) |
| Sidebar location | School Operations |
| Purpose | Notice publishing, audiences and delivery tracking. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 11 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 28 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | notices (referenced by routes; table may be introduced dynamically or under a different migration block), notice_files, communication_campaigns, communication_deliveries, communication_templates |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-notices) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/notice-workspace.ts, schoolhub-server/src/routes/communications.ts, schoolhub-server/src/routes/communication-delivery.ts |

### Tabs, sections and rendering

Factory sections: `notice_details` (11 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| notice_details | date | Date | date | Yes | No | Yes | filterable=true |
| notice_details | title | Title | text | Yes | Yes | Yes | Not declared in factory metadata |
| notice_details | audience | Audience | singleSelect | Yes | No | No | filterable=true |
| notice_details | text | Notice Body | longText | Yes | No | No | Not declared in factory metadata |
| notice_details | status | Status | singleSelect | Yes | No | No | filterable=true |
| notice_details | createdBy | Created By | workspaceReference | No | No | No | Not declared in factory metadata |
| notice_details | createdAt | Created At | dateTime | No | No | No | Not declared in factory metadata |
| notice_details | updatedAt | Updated At | dateTime | No | No | No | Not declared in factory metadata |
| notice_details | expiryDate | Expiry Date | date | No | No | No | Not declared in factory metadata |
| notice_details | priority | Priority | singleSelect | No | No | No | Not declared in factory metadata |
| notice_details | attachments | Attachments | file | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Create Notice | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Publish Notice | MAIN | workspaceHeader | save-notice | MAIN:SPECIAL:PUBLISH | direct | Yes |
| Create Notice | MAIN | workspaceHeader | notice-open | MAIN:ADD | drawer | Yes |
| Publish Notice | MAIN | sectionHeader | notice-submit | MAIN:SPECIAL:PUBLISH | direct | Yes |
| Close | MAIN | sectionHeader | drawer-close | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | drawer-cancel | MAIN:VIEW | direct | Yes |

Backend resources: `notice` (28 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is not present in the standard domain-table permanent-delete map; generic archived Grid records can still be permanently deleted with SPECIAL:PERMANENT_DELETE. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (19):

- `GET /api/v1/communication-delivery/configuration` — `schoolhub-server/src/routes/communication-delivery.ts`
- `PATCH /api/v1/communication-delivery/configuration` — `schoolhub-server/src/routes/communication-delivery.ts`
- `GET /api/v1/communication-delivery/templates` — `schoolhub-server/src/routes/communication-delivery.ts`
- `POST /api/v1/communication-delivery/templates` — `schoolhub-server/src/routes/communication-delivery.ts`
- `PATCH /api/v1/communication-delivery/templates/:id` — `schoolhub-server/src/routes/communication-delivery.ts`
- `GET /api/v1/communication-delivery/campaigns` — `schoolhub-server/src/routes/communication-delivery.ts`
- `POST /api/v1/communication-delivery/campaigns` — `schoolhub-server/src/routes/communication-delivery.ts`
- `POST /api/v1/communication-delivery/campaigns/:id/dispatch` — `schoolhub-server/src/routes/communication-delivery.ts`
- `POST /api/v1/communication-delivery/dispatch-due` — `schoolhub-server/src/routes/communication-delivery.ts`
- `GET /api/v1/communication-delivery/inbox` — `schoolhub-server/src/routes/communication-delivery.ts`
- `POST /api/v1/communication-delivery/inbox/:id/read` — `schoolhub-server/src/routes/communication-delivery.ts`
- `POST /api/v1/communication-delivery/inbox/:id/acknowledge` — `schoolhub-server/src/routes/communication-delivery.ts`
- `GET /api/v1/communication-delivery/campaigns/:id/deliveries` — `schoolhub-server/src/routes/communication-delivery.ts`
- `POST /api/v1/communication-delivery/campaigns/:id/retry` — `schoolhub-server/src/routes/communication-delivery.ts`
- `GET /api/v1/communications` — `schoolhub-server/src/routes/communications.ts`
- `POST /api/v1/communications` — `schoolhub-server/src/routes/communications.ts`
- `PATCH /api/v1/communications/:id` — `schoolhub-server/src/routes/communications.ts`
- `POST /api/v1/communications/:id/archive` — `schoolhub-server/src/routes/communications.ts`
- `GET /api/v1/standard-workspaces/notices` — `schoolhub-server/src/routes/standard-workspaces.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| notice_files | notice_id | Notice attachment. |
| communication_deliveries | campaign/recipient | Delivery outcome tracking. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 13. Calendar & Holidays

| Item | Details |
|---|---|
| Workspace | Calendar & Holidays (key: `calendar-holidays`) |
| Sidebar location | School Operations |
| Purpose | School events, holidays, exams and activities. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 25 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 27 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | calendar_events (referenced by routes; table may be introduced dynamically or under a different migration block), calendar_files |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-calendar) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/calendar-workspace.ts, schoolhub-server/src/routes/calendar-events.ts |

### Tabs, sections and rendering

Factory sections: `event_details` (25 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| event_details | title | Event Title | text | Yes | Yes | Yes | Not declared in factory metadata |
| event_details | type | Event Type | singleSelect | Yes | No | No | Not declared in factory metadata |
| event_details | category | Category | singleSelect | No | No | No | Not declared in factory metadata |
| event_details | from | Start Date | date | Yes | No | No | Not declared in factory metadata |
| event_details | startTime | Start Time | time | No | No | No | Not declared in factory metadata |
| event_details | to | End Date | date | Yes | No | No | Not declared in factory metadata |
| event_details | endTime | End Time | time | No | No | No | Not declared in factory metadata |
| event_details | allDay | All Day Event | boolean | No | No | No | Not declared in factory metadata |
| event_details | description | Description | longText | No | No | No | Not declared in factory metadata |
| event_details | audiences | Audience | multiSelect | Yes | No | No | Not declared in factory metadata |
| event_details | classId | Related Class | workspaceReference | No | No | No | Not declared in factory metadata |
| event_details | sectionId | Related Section | workspaceReference | No | No | No | Not declared in factory metadata |
| event_details | teacherId | Related Teacher / Staff | workspaceReference | No | No | No | Not declared in factory metadata |
| event_details | studentId | Related Student | workspaceReference | No | No | No | Not declared in factory metadata |
| event_details | attachments | Attachments | file | No | No | No | Not declared in factory metadata |
| event_details | status | Status | singleSelect | Yes | No | No | Not declared in factory metadata |
| event_details | isHoliday | Mark as Holiday | boolean | No | No | No | Not declared in factory metadata |
| event_details | holidayType | Holiday Type | singleSelect | No | No | No | Not declared in factory metadata |
| event_details | tentative | Tentative Date | boolean | No | No | No | Not declared in factory metadata |
| event_details | lunar | Lunar Date | boolean | No | No | No | Not declared in factory metadata |
| event_details | hidden | Hidden / Archived | boolean | No | No | No | Not declared in factory metadata |
| event_details | noticeId | Linked Notice | workspaceReference | No | No | No | Not declared in factory metadata |
| event_details | createdBy | Created By | workspaceReference | No | No | No | Not declared in factory metadata |
| event_details | createdAt | Created At | dateTime | No | No | No | Not declared in factory metadata |
| event_details | updatedAt | Updated At | dateTime | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Event | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Download | MAIN | row | download | MAIN:VIEW | direct | Yes |
| Create Notice | MAIN | workspaceHeader | notice | MAIN:ADD | direct | Yes |
| Cancel | MAIN | sectionHeader | close | MAIN:VIEW | direct | Yes |
| + | MAIN | sectionHeader | day | MAIN:VIEW | direct | Yes |
| Mode | MAIN | sectionHeader | mode | MAIN:VIEW | direct | Yes |
| Print Month | MAIN | sectionHeader | monthPrint | MAIN:PRINT | print | Yes |
| › | MAIN | sectionHeader | next | MAIN:VIEW | direct | Yes |
| Publish Linked Notice | MAIN | sectionHeader | noticeSave | MAIN:SPECIAL:PUBLISH | direct | Yes |
| View Notice | MAIN | sectionHeader | noticeView | MAIN:VIEW | direct | Yes |
| ‹ | MAIN | sectionHeader | prev | MAIN:VIEW | direct | Yes |
| Retry | MAIN | sectionHeader | reload | MAIN:VIEW | direct | Yes |
| Save Event | MAIN | sectionHeader | save | MAIN:INHERIT | direct | Yes |
| Today | MAIN | sectionHeader | today | MAIN:VIEW | direct | Yes |
| + Add Holiday / Event | MAIN | workspaceHeader | add-holiday | MAIN:ADD | direct | Yes |

Backend resources: `calendar-holiday` (27 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (7):

- `GET /api/v1/calendar-events` — `schoolhub-server/src/routes/calendar-events.ts`
- `POST /api/v1/calendar-events` — `schoolhub-server/src/routes/calendar-events.ts`
- `PATCH /api/v1/calendar-events/:id` — `schoolhub-server/src/routes/calendar-events.ts`
- `POST /api/v1/calendar-events/:id/` — `schoolhub-server/src/routes/calendar-events.ts`
- `POST /api/v1/calendar-events/:id/notice` — `schoolhub-server/src/routes/calendar-events.ts`
- `GET /api/v1/calendar-workspace` — `schoolhub-server/src/routes/calendar-workspace.ts`
- `GET /api/v1/calendar-files/:id` — `schoolhub-server/src/routes/calendar-workspace.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| calendar_files | calendar_event_id | Event attachment. |
| academic_years | date range | Reporting/filter context rather than mandatory FK. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 14. Documents

| Item | Details |
|---|---|
| Workspace | Documents (key: `documents`) |
| Sidebar location | School Operations |
| Purpose | Managed school documents, files, audience and publication. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 20 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 28 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | documents (referenced by routes; table may be introduced dynamically or under a different migration block), document_files |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-documents) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/document-workspace.ts |

### Tabs, sections and rendering

Factory sections: `document_details` (20 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| document_details | name | Document Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| document_details | cat | Category | singleSelect | Yes | No | No | filterable=true |
| document_details | audiences | Audience | multiSelect | Yes | No | No | filterable=true |
| document_details | description | Description | longText | No | No | No | Not declared in factory metadata |
| document_details | tags | Tags | multiSelect | No | No | No | Not declared in factory metadata |
| document_details | documentVersion | Version | text | No | No | No | Not declared in factory metadata |
| document_details | effectiveDate | Effective Date | date | No | No | No | Not declared in factory metadata |
| document_details | expiryDate | Expiry Date | date | No | No | No | Not declared in factory metadata |
| document_details | status | Status | singleSelect | Yes | No | No | filterable=true |
| document_details | requiresAcknowledgement | Requires Acknowledgement | boolean | No | No | No | Not declared in factory metadata |
| document_details | portalVisible | Visible in Parent/Student Portal | boolean | No | No | No | Not declared in factory metadata |
| document_details | attachments | File Attachment | file | No | No | No | Not declared in factory metadata |
| document_details | internalRemarks | Notes / Internal Remarks | longText | No | No | No | Not declared in factory metadata |
| document_details | classId | Related Class | workspaceReference | No | No | No | Not declared in factory metadata |
| document_details | sectionId | Related Section | workspaceReference | No | No | No | Not declared in factory metadata |
| document_details | studentId | Related Student | workspaceReference | No | No | No | Not declared in factory metadata |
| document_details | teacherId | Related Teacher | workspaceReference | No | No | No | Not declared in factory metadata |
| document_details | createdBy | Created By | workspaceReference | No | No | No | Not declared in factory metadata |
| document_details | createdAt | Created At | dateTime | No | No | No | Not declared in factory metadata |
| document_details | updatedAt | Updated At | dateTime | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Document | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Download | MAIN | row | download | MAIN:VIEW | direct | Yes |
| Add Tag | MAIN | workspaceHeader | tagadd | MAIN:ADD | direct | Yes |
| Remove Tag | MAIN | workspaceHeader | tagremove | MAIN:VIEW | confirm | Yes |
| Clear | MAIN | sectionHeader | clear | MAIN:VIEW | direct | Yes |
| Close | MAIN | sectionHeader | close | MAIN:VIEW | direct | Yes |
| Next | MAIN | sectionHeader | next | MAIN:VIEW | direct | Yes |
| Previous | MAIN | sectionHeader | prev | MAIN:VIEW | direct | Yes |
| Retry | MAIN | sectionHeader | reload | MAIN:VIEW | direct | Yes |
| Save | MAIN | sectionHeader | save | MAIN:INHERIT | direct | Yes |
| + Add Document | MAIN | workspaceHeader | add-document | MAIN:ADD | direct | Yes |

Backend resources: `document` (28 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is not present in the standard domain-table permanent-delete map; generic archived Grid records can still be permanently deleted with SPECIAL:PERMANENT_DELETE. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (0):

- No dedicated literal route matched; the module uses generic operational/grid or shared content routes.

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| document_files | document_id | File versions/attachments. |
| record_audience_groups/users | record_id | Audience controls. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 15. Certificates & Forms

| Item | Details |
|---|---|
| Workspace | Certificates & Forms (key: `certificates`) |
| Sidebar location | School Operations |
| Purpose | Certificate requests, issuance and immutable numbering. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 8 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 27 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | certificates (referenced by routes; table may be introduced dynamically or under a different migration block) |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-certificates) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/certificates.ts |

### Tabs, sections and rendering

Factory sections: `certificate_details` (8 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| certificate_details | certificateNumber | Certificate Number | text | No | Yes | Yes | Not declared in factory metadata |
| certificate_details | certificateType | Certificate Type | text | Yes | No | No | filterable=true |
| certificate_details | studentId | Student | workspaceReference | Yes | Yes | No | Not declared in factory metadata |
| certificate_details | academicYear | Academic Year | text | Yes | No | No | filterable=true |
| certificate_details | issueDate | Issue Date | date | No | No | No | filterable=true |
| certificate_details | status | Status | text | Yes | No | No | filterable=true |
| certificate_details | issuedBy | Issued By | text | No | No | No | Not declared in factory metadata |
| certificate_details | reprintCount | Reprint Count | integer | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Issue Certificate | MAIN | workspaceHeader | certificate | MAIN:ADD | drawer | Yes |
| Issue Certificate | MAIN | workspaceHeader | issue | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Revoke Card | MAIN | row | revoke | MAIN:DELETE | confirm | Yes |
| Issue Certificate | MAIN | workspaceHeader | show-cert-tab-issue | MAIN:ADD | direct | Yes |
| Issued History | MAIN | sectionHeader | show-cert-tab-history | MAIN:ADD | direct | Yes |
| Clear Filters | MAIN | sectionHeader | clear-cert-history-filters | MAIN:VIEW | direct | Yes |
| Issue Certificate | MAIN | workspaceHeader | certificate-open | MAIN:ADD | drawer | Yes |
| Close | MAIN | sectionHeader | drawer-close | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | drawer-cancel | MAIN:VIEW | direct | Yes |

Backend resources: `certificate` (27 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (4):

- `GET /api/v1/certificates` — `schoolhub-server/src/routes/certificates.ts`
- `POST /api/v1/certificates/requests` — `schoolhub-server/src/routes/certificates.ts`
- `POST /api/v1/certificates/requests/:id/decision` — `schoolhub-server/src/routes/certificates.ts`
- `POST /api/v1/certificates/:id/reprint` — `schoolhub-server/src/routes/certificates.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| students | student_id | Certificate subject. |
| users | issued_by | Issuer/audit identity. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 16. Uniform

| Item | Details |
|---|---|
| Workspace | Uniform (key: `uniform`) |
| Sidebar location | School Operations |
| Purpose | Uniform catalogue/content records. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 5 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 27 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | school_content_records (referenced by routes; table may be introduced dynamically or under a different migration block), workspace_grid_records |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-uniform) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/school-content.ts, schoolhub-server/src/routes/resource-catalogs.ts |

### Tabs, sections and rendering

Factory sections: `uniform_details` (5 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| uniform_details | name | Category Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| uniform_details | description | Description | longText | No | No | No | Not declared in factory metadata |
| uniform_details | image | Reference Image | text | No | No | No | Not declared in factory metadata |
| uniform_details | document | Document | text | No | No | No | Not declared in factory metadata |
| uniform_details | documentName | Document Name | text | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Uniform Item | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| + Add Category | MAIN | workspaceHeader | open-add-uniform | MAIN:ADD | direct | Yes |

Backend resources: `uniform` (27 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is not present in the standard domain-table permanent-delete map; generic archived Grid records can still be permanently deleted with SPECIAL:PERMANENT_DELETE. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (6):

- `GET /api/v1/resource-catalogs/:kind` — `schoolhub-server/src/routes/resource-catalogs.ts`
- `POST /api/v1/resource-catalogs/:kind/:id/remove` — `schoolhub-server/src/routes/resource-catalogs.ts`
- `GET /api/v1/school-content/:kind` — `schoolhub-server/src/routes/school-content.ts`
- `POST /api/v1/school-content/:kind` — `schoolhub-server/src/routes/school-content.ts`
- `PATCH /api/v1/school-content/:kind/:id` — `schoolhub-server/src/routes/school-content.ts`
- `POST /api/v1/school-content/:kind/:id/remove` — `schoolhub-server/src/routes/school-content.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| workspace_grid_records | workspace_id/tab_key | Generic configured records. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 17. Curriculum

| Item | Details |
|---|---|
| Workspace | Curriculum (key: `curriculum`) |
| Sidebar location | School Operations |
| Purpose | Curriculum catalogue/content records. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 6 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 27 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | school_content_records (referenced by routes; table may be introduced dynamically or under a different migration block), workspace_grid_records |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-curriculum) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/school-content.ts, schoolhub-server/src/routes/resource-catalogs.ts |

### Tabs, sections and rendering

Factory sections: `curriculum_details` (6 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| curriculum_details | class | Class | workspaceReference | Yes | No | Yes | filterable=true |
| curriculum_details | subjects | Subjects | longText | No | Yes | No | Not declared in factory metadata |
| curriculum_details | description | Description | longText | No | No | No | Not declared in factory metadata |
| curriculum_details | image | Reference Image | text | No | No | No | Not declared in factory metadata |
| curriculum_details | document | Document | text | No | No | No | Not declared in factory metadata |
| curriculum_details | documentName | Document Name | text | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Curriculum Entry | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| + Add Curriculum | MAIN | workspaceHeader | open-add-curriculum | MAIN:ADD | direct | Yes |

Backend resources: `curriculum` (27 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is not present in the standard domain-table permanent-delete map; generic archived Grid records can still be permanently deleted with SPECIAL:PERMANENT_DELETE. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (6):

- `GET /api/v1/resource-catalogs/:kind` — `schoolhub-server/src/routes/resource-catalogs.ts`
- `POST /api/v1/resource-catalogs/:kind/:id/remove` — `schoolhub-server/src/routes/resource-catalogs.ts`
- `GET /api/v1/school-content/:kind` — `schoolhub-server/src/routes/school-content.ts`
- `POST /api/v1/school-content/:kind` — `schoolhub-server/src/routes/school-content.ts`
- `PATCH /api/v1/school-content/:kind/:id` — `schoolhub-server/src/routes/school-content.ts`
- `POST /api/v1/school-content/:kind/:id/remove` — `schoolhub-server/src/routes/school-content.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| workspace_grid_records | workspace_id/tab_key | Generic configured records. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 18. Rules & Regulations

| Item | Details |
|---|---|
| Workspace | Rules & Regulations (key: `rules-regulations`) |
| Sidebar location | School Operations |
| Purpose | Rules and regulations content. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 1 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 27 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | school_content_records (referenced by routes; table may be introduced dynamically or under a different migration block), workspace_grid_records |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-rules) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/school-content.ts, schoolhub-server/src/routes/resource-catalogs.ts |

### Tabs, sections and rendering

Factory sections: `rules_content` (1 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| rules_content | html | Rules & Regulations | longText | Yes | Yes | Yes | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Edit | MAIN | sectionHeader | edit-content-rules | MAIN:EDIT | direct | Yes |

Backend resources: `rule-regulation` (27 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is not present in the standard domain-table permanent-delete map; generic archived Grid records can still be permanently deleted with SPECIAL:PERMANENT_DELETE. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (6):

- `GET /api/v1/resource-catalogs/:kind` — `schoolhub-server/src/routes/resource-catalogs.ts`
- `POST /api/v1/resource-catalogs/:kind/:id/remove` — `schoolhub-server/src/routes/resource-catalogs.ts`
- `GET /api/v1/school-content/:kind` — `schoolhub-server/src/routes/school-content.ts`
- `POST /api/v1/school-content/:kind` — `schoolhub-server/src/routes/school-content.ts`
- `PATCH /api/v1/school-content/:kind/:id` — `schoolhub-server/src/routes/school-content.ts`
- `POST /api/v1/school-content/:kind/:id/remove` — `schoolhub-server/src/routes/school-content.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| workspace_grid_records | workspace_id/tab_key | Generic configured records. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 19. Transport

| Item | Details |
|---|---|
| Workspace | Transport (key: `transport`) |
| Sidebar location | School Operations |
| Purpose | Routes, vehicles, staff and student route assignment. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 18 factory fields in 2 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 27 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | transport_routes (referenced by routes; table may be introduced dynamically or under a different migration block), transport_assignments (referenced by routes; table may be introduced dynamically or under a different migration block) |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-transport) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/transport.ts |

### Tabs, sections and rendering

Factory sections: `route_details` (14 fields), `student_assignment` (4 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| route_details | route | Route Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| route_details | routeCode | Route Code | text | Yes | Yes | No | Not declared in factory metadata |
| route_details | vehicle | Vehicle | singleSelect | Yes | No | No | Not declared in factory metadata |
| route_details | driverId | Driver | workspaceReference | Yes | No | No | Not declared in factory metadata |
| route_details | attendantId | Attendant | workspaceReference | No | No | No | Not declared in factory metadata |
| route_details | stops | Stops / Pickup Points | longText | Yes | No | No | Not declared in factory metadata |
| route_details | startTime | Start Time | time | Yes | No | No | Not declared in factory metadata |
| route_details | shift | Shift | singleSelect | Yes | No | No | Not declared in factory metadata |
| route_details | monthlyFee | Monthly Fee | currency | No | No | No | Not declared in factory metadata |
| route_details | capacity | Capacity | integer | No | No | No | Not declared in factory metadata |
| route_details | classIds | Assigned Classes | workspaceReference | No | No | No | Not declared in factory metadata |
| route_details | sectionIds | Assigned Sections | workspaceReference | No | No | No | Not declared in factory metadata |
| route_details | status | Status | singleSelect | Yes | No | No | Not declared in factory metadata |
| route_details | notes | Notes | longText | No | No | No | Not declared in factory metadata |
| student_assignment | studentId | Student | workspaceReference | Yes | Yes | No | Not declared in factory metadata |
| student_assignment | routeId | Route | workspaceReference | No | No | No | filterable=true |
| student_assignment | pickupStop | Pickup Stop | text | No | No | No | Not declared in factory metadata |
| student_assignment | dropStop | Drop Stop | text | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Route | MAIN | workspaceHeader | add | MAIN:ADD | drawer | Yes |
| View | MAIN | row | view | MAIN:VIEW | direct | Yes |
| Edit | MAIN | row | edit | MAIN:EDIT | drawer | Yes |
| Print | MAIN | row | print | MAIN:PRINT | print | Yes |
| Archive | MAIN | row | archive | MAIN:DELETE | confirm | Yes |
| Restore | MAIN | row | restore | MAIN:SPECIAL:RESTORE_ARCHIVED_RECORDS | direct | Yes |
| Assign Student | MAIN | row | assign | MAIN:SPECIAL:ASSIGN_RECORDS | drawer | Yes |
| Remove Assignment | MAIN | row | unassign | MAIN:SPECIAL:ASSIGN_RECORDS | confirm | Yes |
| Clear Filters | MAIN | sectionHeader | clear | MAIN:VIEW | direct | Yes |
| Close | MAIN | sectionHeader | close | MAIN:VIEW | direct | Yes |
| Next | MAIN | sectionHeader | next | MAIN:VIEW | direct | Yes |
| Previous | MAIN | sectionHeader | prev | MAIN:VIEW | direct | Yes |
| Retry | MAIN | sectionHeader | reload | MAIN:VIEW | direct | Yes |
| Save Route | MAIN | sectionHeader | save | MAIN:INHERIT | direct | Yes |
| + Add Stop | MAIN | sectionHeader | stop-add | MAIN:ADD | direct | Yes |
| Remove | MAIN | sectionHeader | stop-remove | MAIN:VIEW | confirm | Yes |

Backend resources: `transport-route` (27 actions; scopes OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is implemented in the standard permanent-delete table map for this workspace, and generic archived Grid records also support it. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (6):

- `GET /api/v1/transport` — `schoolhub-server/src/routes/transport.ts`
- `POST /api/v1/transport/routes` — `schoolhub-server/src/routes/transport.ts`
- `PATCH /api/v1/transport/routes/:id` — `schoolhub-server/src/routes/transport.ts`
- `POST /api/v1/transport/routes/:id/remove` — `schoolhub-server/src/routes/transport.ts`
- `POST /api/v1/transport/routes/:id/restore` — `schoolhub-server/src/routes/transport.ts`
- `PUT /api/v1/transport/assignments/:studentId` — `schoolhub-server/src/routes/transport.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| students | student_id | Student route assignment. |
| staff | driver/attendant reference | Operational staff context. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 20. Assets

| Item | Details |
|---|---|
| Workspace | Assets (key: `assets`) |
| Sidebar location | School Operations |
| Purpose | Asset categories, register, assignments and maintenance. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 10 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 89 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | asset_categories, school_assets, asset_assignments, asset_maintenance_records, specialist_operations_configuration |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-assets) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/specialist-operations.ts |

### Tabs, sections and rendering

Factory sections: `asset_details` (10 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| asset_details | assetNumber | Asset Number | text | Yes | Yes | Yes | Not declared in factory metadata |
| asset_details | name | Asset Name | text | Yes | Yes | Yes | Not declared in factory metadata |
| asset_details | categoryId | Category | text | Yes | No | No | filterable=true |
| asset_details | serialNumber | Serial Number | text | No | Yes | No | Not declared in factory metadata |
| asset_details | acquiredOn | Acquired On | date | No | No | No | filterable=true |
| asset_details | purchaseCostMinor | Purchase Cost | currency | No | No | No | Not declared in factory metadata |
| asset_details | condition | Condition | text | Yes | No | No | filterable=true |
| asset_details | status | Status | text | Yes | No | No | filterable=true |
| asset_details | location | Location | text | No | No | No | filterable=true |
| asset_details | notes | Notes | longText | No | No | No | Not declared in factory metadata |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Add Asset Category | MAIN | workspaceHeader | p20CategoryForm | MAIN:ADD | drawer | Yes |
| Add Asset | MAIN | workspaceHeader | p20AssetForm | MAIN:ADD | drawer | Yes |
| Assign Asset | MAIN | workspaceHeader | p20AssignmentForm | MAIN:SPECIAL:ASSIGN_RECORDS | drawer | Yes |
| Open Maintenance | MAIN | workspaceHeader | p20MaintenanceForm | MAIN:ADD | drawer | Yes |
| Return Asset | MAIN | row | return | MAIN:SPECIAL:RETURN | direct | Yes |
| Complete Maintenance | MAIN | row | complete | MAIN:EDIT | direct | Yes |
| Add Asset Category | MAIN | workspaceHeader | p20CategoryForm-open | MAIN:ADD | drawer | Yes |
| Add Asset Category | MAIN | sectionHeader | p20CategoryForm-submit | MAIN:INHERIT | direct | Yes |
| Add Asset | MAIN | workspaceHeader | p20AssetForm-open | MAIN:ADD | drawer | Yes |
| Add Asset | MAIN | sectionHeader | p20AssetForm-submit | MAIN:INHERIT | direct | Yes |
| Assign Asset | MAIN | workspaceHeader | p20AssignmentForm-open | MAIN:SPECIAL:ASSIGN_RECORDS | drawer | Yes |
| Assign Asset | MAIN | sectionHeader | p20AssignmentForm-submit | MAIN:SPECIAL:ASSIGN_RECORDS | direct | Yes |
| Open Maintenance | MAIN | workspaceHeader | p20MaintenanceForm-open | MAIN:ADD | drawer | Yes |
| Open Maintenance | MAIN | sectionHeader | p20MaintenanceForm-submit | MAIN:INHERIT | direct | Yes |
| Close | MAIN | sectionHeader | drawer-close | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | drawer-cancel | MAIN:VIEW | direct | Yes |

Backend resources: `asset-category` (22 actions; scopes ALL_WORKSPACE); `asset` (23 actions; scopes ALL_WORKSPACE); `asset-assignment` (22 actions; scopes ALL_WORKSPACE); `asset-maintenance` (22 actions; scopes ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is not present in the standard domain-table permanent-delete map; generic archived Grid records can still be permanently deleted with SPECIAL:PERMANENT_DELETE. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (16):

- `GET /api/v1/specialist-operations/configuration` — `schoolhub-server/src/routes/specialist-operations.ts`
- `PATCH /api/v1/specialist-operations/configuration` — `schoolhub-server/src/routes/specialist-operations.ts`
- `GET /api/v1/specialist-operations` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/categories` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/assets` — `schoolhub-server/src/routes/specialist-operations.ts`
- `PATCH /api/v1/specialist-operations/assets/:id` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/assignments` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/assignments/:id/return` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/maintenance` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/maintenance/:id/complete` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/card-templates` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/cards` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/cards/bulk` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/cards/:id/revoke` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/cards/:id/replace` — `schoolhub-server/src/routes/specialist-operations.ts`
- `GET /api/v1/specialist-operations/my-cards` — `schoolhub-server/src/routes/specialist-operations.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| asset_categories | category_id | Required asset category. |
| students/staff | holder id | Assignment holder is one of the two. |
| asset_maintenance_records | asset_id | Maintenance lifecycle. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 21. ID Cards

| Item | Details |
|---|---|
| Workspace | ID Cards (key: `idcards`) |
| Sidebar location | School Operations |
| Purpose | Card templates, issuance, replacement, revocation and verification. |
| Total tabs | 5 visible: Dashboard, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3 |
| Total fields | 8 factory fields in 1 section(s) |
| Total grids | 3 universal grid concepts (GRID_1–GRID_3); a native module can use its own tables inside a selected tab |
| Total permissions | 45 unique resource/action contracts; role UI also exposes 20 normal tab permissions plus 20 special permissions |
| Main database models | id_card_templates, id_card_issues, id_card_number_counters, specialist_operations_configuration |
| Configurable from Admin | Yes: workspace metadata, tab labels, fields/sections, dashboard layout, action metadata, role permissions and section visibility; domain invariants remain server code |
| Main frontend component | SchoolHub_School_Management_App_Complete.html (page-idcards) and Server_Module_Completion/workspace-layout.js |
| Backend service/routes | schoolhub-server/src/routes/specialist-operations.ts |

### Tabs, sections and rendering

Factory sections: `card_details` (8 fields). The current factory maps all sections to MAIN except Exams & Results, where result details map to GRID_1 and co-scholastic details map to GRID_3. Grid 1–3 remain fixed universal concepts, stored records use `workspace_grid_records`, and labels are saved in `workspace_definitions.tab_configuration`.

The four operational tab labels can be renamed; their order and keys are fixed. New arbitrary tab keys cannot be created without code changes. Role permissions can hide/disable access to a tab. Switching tabs reuses one workspace content area: `workspace-layout.js` toggles the dashboard/native pane and universal grid pane rather than appending a second section. Sections and fields are placed through Workspace Manager and persisted in `workspace_sections` and `workspace_fields`.

Dashboard components are persisted in `workspace_definitions.layout_configuration`. Dashboard data must originate from configured fields/tabs and authorized records. With no saved component, the dashboard correctly remains unconfigured; it must not synthesize misleading cards.

### Complete factory field inventory

| Section | Key | Label | Type | Required | Searchable | Preview | Default / validation metadata |
|---|---|---|---|---:|---:|---:|---|
| card_details | cardNumber | Card Number | text | Yes | Yes | Yes | Not declared in factory metadata |
| card_details | holderType | Holder Type | text | Yes | No | No | filterable=true |
| card_details | studentId | Student | workspaceReference | No | No | No | Not declared in factory metadata |
| card_details | staffId | Staff Member | workspaceReference | No | No | No | Not declared in factory metadata |
| card_details | templateId | Template | text | Yes | No | No | Not declared in factory metadata |
| card_details | issuedOn | Issued On | date | Yes | No | No | filterable=true |
| card_details | expiresOn | Expires On | date | No | No | No | filterable=true |
| card_details | status | Status | text | Yes | No | No | filterable=true |

Factory metadata is authoritative for field type, required/searchable/preview flags and protected properties. Where unique, filterable, sortable, read-only, computed, default or validation metadata is absent above, it is not separately declared in the workspace factory; database constraints and route schemas may still enforce it.

### Configured actions and permission gates

| Label | Tab | Placement | Operation | Permission | Interaction | Visible |
|---|---|---|---|---|---|---:|
| Create Card Template | MAIN | workspaceHeader | p20TemplateForm | MAIN:ADD | drawer | Yes |
| Issue Digital Card | MAIN | workspaceHeader | p20IssueForm | MAIN:ADD | drawer | Yes |
| Bulk Issue Cards | MAIN | workspaceHeader | p20BulkForm | MAIN:ADD | drawer | Yes |
| Replace Card | MAIN | row | replace | MAIN:EDIT | direct | Yes |
| Revoke Card | MAIN | row | revoke | MAIN:DELETE | confirm | Yes |
| Create Card Template | MAIN | workspaceHeader | p20TemplateForm-open | MAIN:ADD | drawer | Yes |
| Create Card Template | MAIN | sectionHeader | p20TemplateForm-submit | MAIN:INHERIT | direct | Yes |
| Issue Digital Card | MAIN | workspaceHeader | p20IssueForm-open | MAIN:ADD | drawer | Yes |
| Issue Digital Card | MAIN | sectionHeader | p20IssueForm-submit | MAIN:INHERIT | direct | Yes |
| Bulk Issue Cards | MAIN | workspaceHeader | p20BulkForm-open | MAIN:ADD | drawer | Yes |
| Bulk Issue Cards | MAIN | sectionHeader | p20BulkForm-submit | MAIN:INHERIT | direct | Yes |
| Close | MAIN | sectionHeader | drawer-close | MAIN:VIEW | direct | Yes |
| Cancel | MAIN | sectionHeader | drawer-cancel | MAIN:VIEW | direct | Yes |

Backend resources: `id-card-template` (22 actions; scopes ALL_WORKSPACE); `digital-id-card` (23 actions; scopes SELF, ALL_WORKSPACE).

The action factory controls label, tab, placement, visibility, interaction, refresh behavior and universal permission key. The backend independently authorizes the mapped resource/action/scope. Hiding a button is not the security boundary. System Administrator receives the backend override; other roles require matching stored grants.

Deletion lifecycle: ordinary Delete maps to archive/soft removal when the resource supports it. Restore requires the special restore permission. Permanent Delete is not present in the standard domain-table permanent-delete map; generic archived Grid records can still be permanently deleted with SPECIAL:PERMANENT_DELETE. Permanent deletion requires explicit authorization and the DELETE confirmation contract.

### APIs, forms, grids and operations

Verified associated literal API routes (17):

- `GET /api/v1/specialist-operations/configuration` — `schoolhub-server/src/routes/specialist-operations.ts`
- `PATCH /api/v1/specialist-operations/configuration` — `schoolhub-server/src/routes/specialist-operations.ts`
- `GET /api/v1/specialist-operations` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/categories` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/assets` — `schoolhub-server/src/routes/specialist-operations.ts`
- `PATCH /api/v1/specialist-operations/assets/:id` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/assignments` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/assignments/:id/return` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/maintenance` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/maintenance/:id/complete` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/card-templates` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/cards` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/cards/bulk` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/cards/:id/revoke` — `schoolhub-server/src/routes/specialist-operations.ts`
- `POST /api/v1/specialist-operations/cards/:id/replace` — `schoolhub-server/src/routes/specialist-operations.ts`
- `GET /api/v1/specialist-operations/my-cards` — `schoolhub-server/src/routes/specialist-operations.ts`
- `GET /api/v1/id-card-verify/:token` — `schoolhub-server/src/routes/specialist-operations.ts`

Main-tab forms and native dialogs are opened by configured action interactions. Generic Grid tabs use the universal operational workspace endpoints for list/create/update/archive/restore/permanent-delete and read their columns from workspace field configuration. Search uses fields marked `searchable`; native modules may add domain filters. Print is permission-gated by PRINT/`record.print`; import/export, attachments, publishing, bulk actions and workflow transitions exist only where the resource manifest and route list above implement them.

All mutating routes are expected to write audit events through the shared audit helpers. File-bearing modules use their dedicated attachment tables/routes. Status values and transitions are route-schema/domain controlled; they are not arbitrary workspace fields when doing so would break workflow integrity.

### Relationships and dependencies

| Destination | Reference | Effect |
|---|---|---|
| students/staff | holder id | Card holder snapshot and live reference. |
| id_card_templates | template_id | Design source. |
| id_card_issues | replaced_card_id | Replacement chain. |

### Current limitations

The universal shell is configurable, but domain algorithms, referential validation, specialized workflows and some native table columns remain implemented in route/client code. Workspace Manager action metadata can expose and place those operations; it does not replace their transactional backend logic. Any native control visible without a matching action definition is a configuration debt and should be migrated, not silently duplicated.

## 22. Admin Settings

| Item | Details |
|---|---|
| Workspace | Admin Settings configuration shell |
| Sidebar | Administration |
| Frontend | `SchoolHub_School_Management_App_Complete.html` admin settings pages |
| Backend | `routes/access-management*.ts`, `routes/workspaces.ts`, `routes/workspace-layouts.ts`, `routes/picklists.ts`, `routes/portal-configuration.ts`, `routes/reports.ts`, `routes/production-authority.ts` |
| Database | workspace definitions/sections/fields/versions; access roles/grants/universal permissions; visibility, picklist and configuration tables |
| Permissions | `workspace.configure`, access role/grant management, portal configuration, diagnostics and school management contracts |
| Admin configurable | Yes; this is the administrative control surface |

Admin Settings contains Appearance & Navigation, Login Page, Dashboard Defaults, Report Card Designer, Document & Form Designer, Global Print Header, Workflow Manager, Permission Overview, Users & Roles, Reports, My Portal, Audit Log, System Diagnostics, Application Custom Fields, Workspace Manager, Picklist Manager, Phases and Legacy Data Migration surfaces in the monolithic client. System Administrator receives an effective all-permissions override on the backend; other roles depend on stored grants and universal permission selections.

Workspace Manager changes names, descriptions, tab labels, sections, fields, layout/dashboard components, action presentation, relationships, print settings and role section visibility. It does not make every domain invariant data-driven: transaction validation, foreign keys, state machines, specialized dialogs and side effects remain backend code. That boundary prevents an administrator from configuring an invalid financial, attendance, assessment or identity workflow.

## Workspace layout audit

| Workspace | Dashboard | Main Tab | Grid 1 | Grid 2 | Grid 3 | Other Tabs |
|---|---|---|---|---|---|---|
| Students | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Teachers & Staff | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Classes & Sections | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Attendance | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Time Table | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Homework | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Teacher Work Log | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Exams & Results | Configured layout | Assessments | Marks Entry | Report Cards | Co-scholastic | None in universal shell |
| Fees & Payments | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Leave Requests | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Notice Board | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Calendar & Holidays | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Documents | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Certificates & Forms | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Uniform | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Curriculum | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Rules & Regulations | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Transport | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| Assets | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |
| ID Cards | Configured layout | Main Tab | Grid Tab 1 | Grid Tab 2 | Grid Tab 3 | None in universal shell |

Definitions: `defaultWorkspaceTabs()` supplies the four operational names. Only Exams & Results has non-generic factory defaults. `workspace_definitions.tab_configuration` stores overrides. Keys and order are fixed; labels and permissions are configurable. Visibility is controlled through universal role permissions, while section-level role visibility is stored separately. A tab cannot be replaced with an arbitrary new renderer without code, but its configured content can be fields/sections, a form/document mode, generic grid records, or domain actions where supported.

The shared renderer uses one content region. Dashboard selection displays `.sh-workspace-dashboard`; MAIN displays the preserved native/main content; GRID_1–3 display `.uw-grid-pane`. It does not add a new layout block on each switch. Relevant code: `Server_Module_Completion/workspace-layout.js` and `Server_Module_Completion/universal-workspace-tabs.js`.

## Attendance deep audit

The actual Attendance workspace factory has one section (`attendance_details`) with Attendance Date, Period, Student, Status and Remark. Its universal labels remain Main Tab, Grid Tab 1, Grid Tab 2 and Grid Tab 3. The intended labels “Period Structure”, “Teacher Timetable” and “Schedule List” are not Attendance factory defaults. Period Structure and timetable scheduling currently belong to the Time Table workspace, whose two factory sections are `timetable_slot` and `period_structure`.

The verified dependency chain is:

`academic_years → classes → sections → subjects/staff teacher assignments → school_periods → timetable_entries → attendance_records`

- `timetable_entries` requires academic year and class, and optionally references section, subject and teacher.
- `attendance_records` requires a student; the student supplies class/section/year context. Period is stored as the attendance period value/key and is checked against scheduling context in application logic rather than by a direct `school_periods` foreign key.
- Teacher timetable and schedule list are timetable views, not separate Attendance database entities.
- To present those views under Attendance without duplicating data, configure Attendance actions/views to reference timetable resources and enforce timetable view permission. Do not copy schedule rows into Attendance grids.

Attendance supports view, create/mark, update/correct, print/export and audit contracts. The manifest does not advertise archive as a normal domain action, even though the standard permanent-delete table registry includes attendance records. This mismatch should be treated cautiously: permanent deletion should only follow a defined archive lifecycle, or be withheld until that lifecycle is explicit.

## Admin Settings configuration matrix

| Module | Fields | Tabs | Grids | Sections | Permissions | Roles | Workflow | Other settings and how changed |
|---|---|---|---|---|---|---|---|---|
| Students | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Teachers & Staff | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Classes & Sections | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Attendance | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Time Table | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Homework | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Yes — action/workflow contracts | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Teacher Work Log | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Exams & Results | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Yes — action/workflow contracts | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Fees & Payments | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Leave Requests | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Yes — action/workflow contracts | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Notice Board | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Yes — action/workflow contracts | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Calendar & Holidays | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Documents | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Yes — action/workflow contracts | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Certificates & Forms | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Uniform | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Curriculum | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Rules & Regulations | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Transport | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| Assets | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |
| ID Cards | Yes — workspace field editor | Yes — tab configuration labels | Yes — universal grid records/columns | Yes — section editor and role visibility | Yes — universal permission matrix | Yes — Users & Roles grants | Partial — only configured actions | Dashboard Layout, action definitions, relationships and Print & Branding; saved through Workspace Manager APIs |

Changes are written through `/api/v1/workspaces` and related layout/action/access routes into workspace and access-control tables. Preview uses the chosen role’s effective grants. Reset to Factory restores factory v22 metadata. Factory-protected fields keep their key/type/required/archive invariants. The System Administrator backend override grants all supported actions but action buttons still require a configured visible action mapping; authority alone does not invent UI controls.

## Cross-module dependency matrix

| Source module | Destination entity/module | Reference | Mandatory | Delete/update implication |
|---|---|---|---:|---|
| Students | classes | class_id | Yes | Required placement; class deletion is restricted by FK. |
| Students | sections | section_id | Context-dependent | Optional placement; section updates affect display. |
| Students | academic_years | academic_year_id | Context-dependent | Optional/current enrolment context. |
| Students | guardian_student_links | student_id | Context-dependent | Guardian access and child scope. |
| Teachers & Staff | teacher_assignments | teacher_id | Context-dependent | Teaching context drives scoped access. |
| Teachers & Staff | users | teacher_id | Context-dependent | Optional login identity. |
| Classes & Sections | sections | class_id | Yes | Required parent-child relationship. |
| Classes & Sections | teacher_assignments | class_id | Context-dependent | Assignments depend on class. |
| Classes & Sections | students | class_id | Context-dependent | Student placement prevents unsafe delete. |
| Attendance | students | student_id | Yes | Required attendee. |
| Attendance | school_periods | period_key | Context-dependent | Period context is textual/key based. |
| Attendance | timetable_entries | class/section/period | Context-dependent | Contextual relationship, not a direct attendance FK. |
| Time Table | academic_years | academic_year_id | Yes | Required. |
| Time Table | classes | class_id | Yes | Required. |
| Time Table | sections | section_id | Context-dependent | Optional. |
| Time Table | subjects | subject_id | Context-dependent | Optional. |
| Time Table | staff | teacher_id | Context-dependent | Optional teacher. |
| Time Table | school_periods | period_key | Context-dependent | Period definition key. |
| Homework | classes | class_id | Yes | Required audience context. |
| Homework | sections | section_id | Context-dependent | Optional audience. |
| Homework | subjects | subject_id | Context-dependent | Optional subject. |
| Homework | staff | teacher_id | Context-dependent | Optional author/teacher. |
| Homework | homework_files | homework_id | Context-dependent | Cascade-style attachment lifecycle. |
| Homework | homework_acknowledgements | homework_id | Context-dependent | Recipient acknowledgement. |
| Teacher Work Log | staff | teacher_id | Context-dependent | Teacher ownership. |
| Teacher Work Log | subjects | subject_id | Context-dependent | Optional subject. |
| Teacher Work Log | timetable_entries | timetable_entry_id | Context-dependent | Optional schedule evidence. |
| Exams & Results | exam_records | class_id/section_id/subject_id | Context-dependent | Assessment context. |
| Exams & Results | mark_records | exam_id/student_id | Yes | Required exam and student. |
| Exams & Results | co_scholastic_evaluations | student_id | Context-dependent | Student skill/rating. |
| Exams & Results | report_card_snapshots | student_id/academic_year_id | Context-dependent | Published immutable output. |
| Fees & Payments | students | student_id | Yes | Required ledger owner. |
| Fees & Payments | academic_years | academic_year_id | Context-dependent | Optional fee period. |
| Leave Requests | users/students/staff | applicant reference | Context-dependent | Applicant context is validated by route/workflow. |
| Leave Requests | leave_files | leave_request_id | Context-dependent | Evidence attachment. |
| Notice Board | notice_files | notice_id | Context-dependent | Notice attachment. |
| Notice Board | communication_deliveries | campaign/recipient | Context-dependent | Delivery outcome tracking. |
| Calendar & Holidays | calendar_files | calendar_event_id | Context-dependent | Event attachment. |
| Calendar & Holidays | academic_years | date range | Context-dependent | Reporting/filter context rather than mandatory FK. |
| Documents | document_files | document_id | Context-dependent | File versions/attachments. |
| Documents | record_audience_groups/users | record_id | Context-dependent | Audience controls. |
| Certificates & Forms | students | student_id | Context-dependent | Certificate subject. |
| Certificates & Forms | users | issued_by | Context-dependent | Issuer/audit identity. |
| Uniform | workspace_grid_records | workspace_id/tab_key | Context-dependent | Generic configured records. |
| Curriculum | workspace_grid_records | workspace_id/tab_key | Context-dependent | Generic configured records. |
| Rules & Regulations | workspace_grid_records | workspace_id/tab_key | Context-dependent | Generic configured records. |
| Transport | students | student_id | Context-dependent | Student route assignment. |
| Transport | staff | driver/attendant reference | Context-dependent | Operational staff context. |
| Assets | asset_categories | category_id | Yes | Required asset category. |
| Assets | students/staff | holder id | Context-dependent | Assignment holder is one of the two. |
| Assets | asset_maintenance_records | asset_id | Context-dependent | Maintenance lifecycle. |
| ID Cards | students/staff | holder id | Context-dependent | Card holder snapshot and live reference. |
| ID Cards | id_card_templates | template_id | Context-dependent | Design source. |
| ID Cards | id_card_issues | replaced_card_id | Context-dependent | Replacement chain. |

Foreign keys in `schoolhub-server/src/database/migrations.ts` are the strongest relationship evidence. Route-only references are identified as such in the module chapters. Updates use optimistic versions across major records. Safe deletion is archive-first; required foreign keys prevent deleting referenced parents, and permanent-delete support is deliberately narrower than archive support.

## Additional modules discovered during code audit

| Built-in workspace | Fields | Resources | Sidebar status / purpose |
|---|---:|---:|---|
| Academic Year (`academic-years`) | 1 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| Section (`sections`) | 2 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| Subject (`subjects`) | 1 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| System User (`users`) | 1 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| Homework Acknowledgement (`homework-acknowledgements`) | 7 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| School Settings (`school`) | 10 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| Portal (`portal`) | 3 | 2 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| Diagnostic (`diagnostics`) | 3 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| Workflow (`workflows`) | 4 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |
| Report (`reports`) | 5 | 1 | Supporting/reference/admin workspace; not one of the 22 authoritative sidebar entries |

Route-only supporting capabilities also include exam logistics, communication delivery, workflow tasks, production authority, portal configuration, reports, picklists and standard/universal operational workspace routes. These are dependencies or admin capabilities rather than missing sidebar items.

## Hard-coded versus database-driven boundary

| Concern | Current source of truth |
|---|---|
| Workspace names/descriptions/category/icon/status | Database, seeded from factory |
| Main/Grid labels | Database `tab_configuration`, defaulted by factory |
| Sections and fields | Database, seeded/protected by factory |
| Dashboard components/layout | Database `layout_configuration` |
| Generic grid data | Database `workspace_grid_records` |
| Action label/placement/visibility/permission mapping | Action configuration seeded from `workspace-actions.json`; editable through Workspace Manager where exposed |
| Role permission selections | Database access roles/universal permission tables |
| Authorization meaning and scopes | Backend policy registry code |
| Domain validation/state transitions/side effects | Backend route/service code |
| Native operational dialogs and complex table renderers | Frontend code, invoked/gated by configuration and permission |
| Database integrity | Migrations/constraints |

This boundary is necessary: Workspace Manager should control what users see and which configured operations they can invoke, while backend code must retain validation and transactional safety. “Everything visible is controlled by Workspace Manager” is satisfied only when each visible action has a configuration entry; it does not mean financial or identity rules become unvalidated JSON.

## Known gaps and recommended follow-up

1. Audit each native page at runtime to ensure every rendered header/row action resolves to a Workspace Manager action definition. The existing automated action audit covers the 20 operational page mappings, but it should remain a release gate.
2. Several content/catalog modules use shared routes and generic grid storage. Their factory fields are real, but their native persistence may not have a one-table-per-module model. Keep this explicit in product documentation.
3. Dashboard and Admin Settings are not operational workspaces. Bringing the top-level Dashboard under Workspace Manager would be new functionality and should be designed separately.
4. Literal API totals omit dynamically composed route suffixes by definition. `schoolhub-audit-data.json` preserves the complete 294 literal route inventory used for this report.
5. Permanent-delete support is intentionally uneven. Do not expose it merely because a role has the special permission; require an archived state, route support and dependency safety.
6. The factory automatically provides starter dashboard components for seeded workspaces. If product policy requires an empty dashboard until an administrator saves components, remove/alter that seeding only through an explicit migration/product decision; otherwise the application can display generated summaries the administrator did not select.

## Evidence index

- `SchoolHub_School_Management_App_Complete.html`
- `Server_Module_Completion/workspace-layout.js`
- `Server_Module_Completion/workspace-actions.js`
- `Server_Module_Completion/workspace-dashboard.js`
- `Server_Module_Completion/universal-workspace-tabs.js`
- `schoolhub-server/src/services/workspace-service.ts`
- `schoolhub-server/src/factories/workspace-actions.json`
- `schoolhub-server/src/authorization/universal-workspace-permissions.ts`
- `schoolhub-server/src/authorization/policy-registry.ts`
- `schoolhub-server/src/database/migrations.ts`
- `schoolhub-server/src/routes/`
- `schoolhub-audit-data.json`


# Modified requirement: Workspace Manager and Permission System deep audit

This section is authoritative for the modified requirement. It audits source code, schemas, migrations, APIs, seed factories, current database aggregates, and client behavior. Screenshot controls are treated as evidence only.

## A. Workspace Manager — complete audit

The client currently exposes nine configuration areas: General, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3, Layout, Action Buttons, Relationships, and Print & Branding. Preview Workspace, Version History, All Workspaces and Reset to Factory are page commands rather than additional configuration tabs. No further Workspace Manager configuration tab was found.

### General configuration

| Setting | Storage | Runtime behavior and restriction |
|---|---|---|
| Internal ID | workspace_definitions.id | Generated stable identity; not editable |
| Stable key | workspace_definitions.workspace_key | Unique per school; backend rejects changes with IMMUTABLE_WORKSPACE_KEY |
| Singular/plural name | name, plural_name | Editable and used in headings and metadata |
| Description/category/icon | definition columns | Editable; category/icon are available to navigation metadata |
| Lifecycle | status: Draft, Active, Archived | Custom definitions may change state; built-ins must remain Active |
| System marker | system, workspace_type | Distinguishes factory-protected and custom workspaces |
| Factory/definition/version | factory_version, definition_version, version | Factory revision, displayed metadata revision and optimistic-lock revision are distinct |
| Record numbering | record_number_configuration JSONB | Enabled flag and format |
| Navigation | navigation_configuration JSONB | Show in menu, parent menu and menu position |
| Behavior | behavior_configuration JSONB | Search, filtering, import, export, history, duplicate, print, archive, bulk and attachment flags |
| Tab labels | tab_configuration JSONB | Four fixed operational tab keys with editable labels |
| Dashboard/layout/actions/content | layout_configuration JSONB | Validated layout schema version 1 |
| Print | print_configuration JSONB | Page, template, branding and watermark configuration |

System workspaces cannot be archived. Stable workspace keys cannot be changed. Factory-protected field properties cannot be changed. Custom-field deletion requires an impact check. Built-in identities are recoverable through factory reset.

### Workspace record numbering

The validated number format contains exactly one placeholder of 2–12 zeroes, for example STU-{00000}. The backend nextWorkspaceNumber function:

1. inserts the school/workspace sequence row if absent;
2. locks that row with SELECT FOR UPDATE;
3. reads next_number;
4. loads the enabled workspace format or the caller’s fallback;
5. pads and substitutes the placeholder;
6. increments the stored sequence; and
7. returns the generated value.

Numbering is tenant-specific and workspace-specific. The implementation has no separate suffix property, configurable increment size, academic-year segment, scheduled reset rule, or administrator-set starting-number control. Changing the format does not renumber existing records. Evidence: schoolhub-server/src/services/workspace-numbering.ts, routes/workspaces.ts, and workspace_number_sequences in migrations.

### Workspace navigation

Trace:

Workspace Manager General form
→ PUT /api/v1/workspaces/:id
→ workspaces:configure check
→ WorkspaceService.update
→ workspace_definitions.navigation_configuration
→ workspace definition read

The model stores showInMainMenu, parentMenu and menuPosition. The primary 22-entry sidebar is still authored in SchoolHub_School_Management_App_Complete.html. A general navigation endpoint/renderer that rebuilds this sidebar from navigation_configuration was not found.

**IMPLEMENTATION GAP — navigation settings persist, but the primary sidebar remains code-defined.**

Role and tab visibility is still applied when an operational workspace loads. An archived workspace is excluded or rejected by backend workspace queries.

### Main Tab

Main Tab fields are workspace_fields rows with tab_key MAIN, optionally grouped by workspace_sections. Configurable properties include label, description/help text, type, required/default value, placeholder, width, order, screen/preview/print visibility, searchable, filterable, options, and adapter-specific configuration. Stable system field keys and protected properties are guarded.

Sections control name, description, order, enabled state, screen/print visibility, layout columns and independent layout JSON. Main Tab content can be fields or a versioned Form/Document template assignment. A general conditional-visibility expression engine was not found; configuration does support adapter-specific dependencies and read-only rules.

Runtime rendering reads the saved definition, projects role-visible sections/fields, and uses the same workspace content area.

### Grid Tab 1, Grid Tab 2 and Grid Tab 3

Each grid has a fixed key: GRID_1, GRID_2 or GRID_3. Labels are configurable; keys and order are fixed. They must be audited independently because resource manifests can map different resources to different default tabs.

| Grid concern | Current support |
|---|---|
| Name | Saved in tab_configuration |
| Stable key | Fixed GRID_1 / GRID_2 / GRID_3 |
| Enable/disable | No independent enabled flag; access/visibility is permission-driven |
| Content source | Fields, Form/Document assignment, generic workspace_grid_records, or a native adapter |
| Entity/API | Generic grid API unless a domain resource adapter provides its own entity |
| Columns/order/width | Derived from fields assigned to the tab |
| Search/filter | Field flags plus adapter behavior |
| Sorting | Native/generic implementation; no separate universal default-sort schema |
| Pagination | Generic grid/native table implementation |
| Row/bulk actions | Configured actions plus adapter support |
| Add/Edit/Delete/Print | Tab permission plus backend resource action |
| Import/export/assignment | Only when manifest, behavior flag and adapter implement it |
| Archive/restore/permanent delete | Generic grid supports lifecycle; native domain varies |
| Empty state | Universal/native renderer |
| Saved views | Native table “My view” support; no standalone grid-view schema found |

Tab content is mutually assigned as fields or a versioned Form/Document. Grid configuration is not a separate arbitrary JSON object; it is composed from tab fields, layout content, actions, permissions and optional adapter code.

### Layout configuration

workspace_definitions.layout_configuration stores validated JSON with:

- schemaVersion 1;
- enabled and density;
- dashboardSource;
- up to 60 metric, chart, filters, table, calendar, schedule or card components;
- source tab and field mappings;
- full/half/third/quarter widths;
- count, distinct, sum, average, min, max or ratio aggregation;
- bar, horizontal bar, stacked bar, line, area, pie or donut visualization;
- palette, icon, labels, legend, percentages, conditions, role names and limits;
- four tab-content assignments; and
- up to 200 action definitions.

Field mappings must exist on the selected source tab. Numeric aggregations require numeric fields. Calendar mappings require dates. Main form arrangement also uses section layouts, layout columns, field widths/order and print page breaks. Responsive behavior is CSS/client driven.

### Action Buttons configuration

An action stores its stable ID/key, operation binding, label, description, tab, optional section, placement, style, icon, visible flag, order, permission and permission-source tab, role names, interaction, confirmation/success message and refresh scope.

Administrators can add/remove, rename, reorder, hide, place and role-restrict action metadata. They cannot create a functioning backend operation merely by inventing an operationKey; a registered client/backend adapter must exist. State restrictions are enforced by domain routes and authorization context.

| Action family | Permission source | Backend meaning |
|---|---|---|
| View | tab VIEW | record.view/report.view/submission.view |
| Add | tab ADD | record.create/submission.create |
| Edit | tab EDIT | record.update/marks entry/submission update |
| Delete | tab DELETE | archive/withdraw, not unconditional physical delete |
| Print | tab PRINT | record.print/report.export |
| Import | SPECIAL:IMPORT_RECORDS | import.validate/import.execute |
| Audit | SPECIAL:VIEW_CHANGE_LOG | audit.view |
| Restore | SPECIAL:RESTORE_ARCHIVED_RECORDS | record.restore/unarchive |
| Permanent delete | SPECIAL:PERMANENT_DELETE | record.permanent_delete |
| Assign/change owner | corresponding special permission | manage_assignees/transfer_ownership |
| Publish/unpublish | corresponding special permission | publication or assessment transition |
| Acknowledge | SPECIAL:ACKNOWLEDGE | record.acknowledge |
| Submit/review/approve/reject/return/cancel | corresponding special permission | workflow/domain transition |
| Override locks | SPECIAL:OVERRIDE_RECORD_LOCKS | override_locks/assessment moderation where implemented |

The 20 operational factories contain 285 action definitions. The current database contains 567 saved action definitions across three schools.

### Relationships configuration

A configurable relationship is primarily a workspaceReference field with target workspace, target/display field, relationship type, single/multiple selection, dependency and lookup filtering in workspace_fields.configuration. Real foreign keys and junction tables remain migration/domain code.

An administrator can configure safe lookup metadata but cannot create a new database foreign key, cascade rule or transaction from the UI. The current database has 116 active workspace-reference fields. The earlier cross-module matrix identifies verified foreign keys and route-only relationships.

### Print & Branding

Workspace print settings include:

- A4, Letter or Legal;
- portrait/landscape;
- 5–40 mm margins;
- page numbers and repeated headers;
- future-template inclusion;
- certificate/form/receipt/other template categories;
- global branding with header style;
- text/image watermark, opacity, position, rotation and size;
- section and field print visibility; and
- section page breaks.

Document & Form Designer provides versioned templates. School logo and identity come from Global Print Header. Print requires tab PRINT or the corresponding report/export permission. The workspace configuration does not itself constitute a server PDF engine.

### Workspace Version History

Workspace mutations call snapshot before and after significant changes. workspace_definition_versions stores full definition JSON, change reason, actor and timestamp, unique by workspace/version. History requires workspaces:view.

The current UI is read-only. No arbitrary rollback/restore-version endpoint was found. Field, section, tab, layout and general changes are captured because the snapshot is the complete definition. Role permissions live in separate access tables and are not part of a workspace snapshot.

### Preview Workspace

Preview Workspace renders the last saved definition loaded by the client. It shows enabled, screen-visible sections and fields. It does not save drafts, create record storage, simulate another role, or fully execute operational grids/dashboard behavior.

The Layout endpoint provides a separate role-aware projection and live preview. Preview therefore has two meanings: metadata preview in Workspace Manager, and role-projected layout preview in the Layout editor.

### Reset to Factory

Reset requires workspaces:reset, is allowed only for a built-in workspace, provides a read-only preview, requires confirmed:true and matching optimistic version, runs transactionally and writes an audit event.

It restores factory name/plural/description/category/icon/status, factory version, default tab labels, and factory system sections/fields. It preserves operational records and custom sections/fields. Current code does not erase role permissions, generic record data, or all independent layout/action/print/navigation/behavior JSON. A before-reset snapshot exists, but no public version rollback endpoint exists.

### Configuration persistence traces

| Change | Request/auth | Storage | Live effect |
|---|---|---|---|
| Grid 1 assignment | field/section update or layout PUT; workspaces:configure | field/section tab_key and layout tabContent | read on workspace reload by grid renderer |
| Field change | workspace-field API; validation + optimistic version | workspace_fields/options + snapshot | projected into runtime definition |
| Main Tab | section/field APIs and tab content | sections, fields, layout JSON | native/main or template renderer |
| Layout/dashboard/actions | PUT /api/v1/workspace-layouts/:workspaceKey | layout_configuration | role-projected layout/action/dashboard renderer |
| Role permission | standardized role create/update | universal selections + normalized grants | resolved per authorization request; no application cache found |
| Navigation | workspace update | navigation_configuration | metadata persists; primary sidebar consumption incomplete |

### System and custom workspaces

The repository seeds 30 built-in definitions: 20 operational workspaces and 10 supporting/admin definitions. The current database has 62 definitions across three schools: 61 system and 1 custom; all 62 are active.

Built-ins cannot be archived, their keys are immutable, and protected system field properties cannot change. Custom workspaces can be created/archived and use the metadata engine, but require generic storage or a code adapter for specialized workflows. System tab keys cannot be deleted. Non-operational system areas use Setup Administration rather than ordinary workspace roles.

## B. Complete Role and Permission system audit

### Tab-level permissions

| Workspace area | View | Add | Edit | Delete | Print | Storage |
|---|---:|---:|---:|---:|---:|---|
| MAIN | VIEW | ADD | EDIT | DELETE | PRINT | access_role_universal_permissions |
| GRID_1 | VIEW | ADD | EDIT | DELETE | PRINT | access_role_universal_permissions |
| GRID_2 | VIEW | ADD | EDIT | DELETE | PRINT | access_role_universal_permissions |
| GRID_3 | VIEW | ADD | EDIT | DELETE | PRINT | access_role_universal_permissions |

The stored model is MAIN + VIEW, not a string such as assets.main.view. The named role is tied to one workspace. universalPermissionsToGrants translates selections into resource/action/scope grants supported by the workspace manifest.

### Complete special-permission registry

| Display name | Key | Purpose | Scope and enforcement |
|---|---|---|---|
| Workspace Administrator | WORKSPACE_ADMINISTRATOR | All supported actions, all-record/assigned and archived visibility | One workspace role; manifest-limited |
| Import Records | IMPORT_RECORDS | import.validate/execute | Requires Add or Edit context |
| View Change Log | VIEW_CHANGE_LOG | audit.view | Requires View |
| View Archived Records | VIEW_ARCHIVED_RECORDS | Adds viewArchived constraint | Workspace records |
| Restore Archived Records | RESTORE_ARCHIVED_RECORDS | record.restore/unarchive | Requires Edit context |
| Permanent Delete | PERMANENT_DELETE | record.permanent_delete | Requires Delete and route support |
| View Records Owned by Others | VIEW_RECORDS_OWNED_BY_OTHERS | Uses ALL_WORKSPACE where allowed | Policy-limited |
| View Assigned Records | VIEW_ASSIGNED_RECORDS | Enables assigned scopes | Policy-limited |
| Assign Records | ASSIGN_RECORDS | record.manage_assignees | Requires Edit context |
| Change Record Owner | CHANGE_RECORD_OWNER | record.transfer_ownership | Requires Edit context |
| Publish | PUBLISH | record.publish/assessment publication | Domain state validated |
| Unpublish | UNPUBLISH | record.unpublish/reopen results | Domain state validated |
| Acknowledge | ACKNOWLEDGE | record.acknowledge | Requires View |
| Submit | SUBMIT | workflow.submit/submission create | Domain state validated |
| Review | REVIEW | workflow.review | Domain state validated |
| Approve | APPROVE | workflow.approve | Domain state validated |
| Reject | REJECT | workflow.reject | Domain state validated |
| Return | RETURN | workflow.return/submission return | Domain state validated |
| Cancel | CANCEL | workflow.cancel/submission withdraw | Domain state validated |
| Override Record Locks | OVERRIDE_RECORD_LOCKS | override_locks/assessment moderation | Only where an adapter implements it |

Frontend action projection checks these permissions, and the backend independently evaluates resource/action/scope.

### Permission scope

Implemented scopes are OWNED, CREATED_BY, SELF, DIRECT_ASSIGNED, DIRECT_RECIPIENT, GROUP, CLASS, SECTION, AUDIENCE, CHILD_PERSONAL, CHILD_ASSIGNED, CHILD_RECIPIENT, ASSIGNED_TEACHING_CONTEXT, ASSIGNED_CLASS, ASSIGNED_SECTION, ASSIGNED_STUDENT, CASE_ASSIGNED, DEPARTMENT, CLUB, HOUSE, ROUTE, HOSTEL, SCHOOL_PUBLISHED and ALL_WORKSPACE.

Tenant isolation uses school_id. Tab is a grant constraint. Field-readable/writable constraints exist in the policy engine. Grants are additive; no explicit deny model was found.

### Workspace Administrator versus System Administrator

WORKSPACE_ADMINISTRATOR is a special selection on one named role for one workspace. It expands only to actions/scopes in that workspace manifest. It does not grant Setup Administration or global Workspace Manager control.

System Administrator uses principal.systemRecovery. It bypasses registered permission checks with SYSTEM_RECOVERY_AUTHORITY and gets all supported tabs/actions. This is the tenant-wide recovery authority.

### Ownership and assignment

record_access_controls stores owner_user_id, assigned_user_id, audience type, class and section. Junction tables support multiple audience groups/users, while generic direct assignment is singular. Domain records can separately supply creator, subjects and recipients.

Record creator, owner and assigned user are distinct. Groups carry audiences and roles; roles are not record owners. Ownership/assignment changes require their corresponding action. Inactive users are rejected by authentication and by relevant assignment validation.

### Archive and deletion lifecycle

Normal Delete maps to archive, withdraw, void, revoke or another reversible domain transition. Archived visibility and restore need separate permissions. Physical deletion needs the special permission, Setup Administration in the standardized endpoint, explicit confirmation, a supported table mapping and foreign-key safety. Every physical deletion is tenant-scoped and audited.

Lifecycle:

Active → Archived → Restored

and, only where implemented:

Archived → Permanently Deleted

Generic Grid records implement this lifecycle. Several native domains intentionally use specific states such as Voided, Revoked, Replaced or Inactive.

### Record locking

The permission registry exposes OVERRIDE_RECORD_LOCKS, but no generic lock table, lock owner, expiry timer, acquisition/release API or universal lock manager was found. Concurrency primarily uses integer versions and SELECT FOR UPDATE transactions.

> **INCOMPLETE FEATURE — the permission exists, but a complete generic record-lock subsystem was not found.**

### Workflow permissions

There is a workflow manifest and workflow-task API, but state machines remain domain-specific.

| Area | Verified transition model | Permissions |
|---|---|---|
| Leave Requests | submit, review, approve, reject, return and cancel states/actions | workflow.* |
| Fee corrections | Pending → Approved or Rejected | review/approve/reject |
| Exams & Results | marks entry/moderation, publish, reopen; snapshot locks | assessment actions |
| Homework | publication and acknowledgement where route supports it | publish/unpublish/acknowledge |
| Notices/Documents | publication, audience and archive states | publish/unpublish/manage audience |

There is no single universal Draft → Submitted → Reviewed → Approved → Published chain applied to every workspace.

### Groups and effective permission resolution

Users may belong to multiple active groups. Groups may link to multiple active named workspace roles. Roles may link to multiple groups. Grants merge additively and duplicates are removed. There are no direct per-user workspace grants and no explicit deny.

Effective resolution:

Authenticated principal
→ school/tenant
→ active group memberships
→ active named roles for selected workspace
→ universal selections and/or normalized grants
→ resource, action and tab match
→ teacher/student/guardian/group relationship context
→ lifecycle/sensitivity constraints
→ scope match
→ backend allow/deny
→ capability projection to UI
→ tab/action rendering

Primary code: authorization/policy-engine.ts, universal-workspace-permissions.ts, policy-registry.ts, operational-workspaces.ts and access-management-standard.ts.

### Enforcement verification

| Category | Frontend | Backend | Ownership/scope | Tenant | Risk |
|---|---:|---:|---:|---:|---|
| Tab View/Add/Edit/Delete/Print | Yes | Yes | Where record context supplies it | Yes | Low; adapter must pass correct resource/tab |
| Workflow actions | Configured action checked | Domain route checked | Domain-dependent | Yes | Medium if an action has no adapter; it will fail rather than gain authority |
| Workspace configuration | Hidden/gated | workspaces:configure | Admin permission | Yes | Low |
| Permanent delete | Hidden, confirmed | Setup admin + grant + supported table + FK handling | Grant checked | Yes | Low but coverage uneven |
| Record lock override | Permission shown | Only where adapter uses action | Domain-dependent | Yes | **Incomplete feature** |
| Navigation visibility | Setting shown | Archived workspace rejected | Role checked after selection | Yes | **Static-sidebar gap** |

No major mutation route in the audited modules was identified as intentionally protected only by frontend visibility. The remaining risk is adapter completeness: a visible action must bind to a permission-checked backend handler.

## C. Workspace-to-permission matrix

Normal tab actions are universal; the manifest decides whether a resulting resource action is meaningful.

| Workspace | Main | Grid 1 | Grid 2 | Grid 3 | Special permissions | Workspace Admin |
|---|---|---|---|---|---|---|
| Students | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20 registry keys, manifest-limited | Yes |
| Teachers & Staff | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Classes & Sections | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Attendance | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Time Table | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Homework | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Teacher Work Log | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Exams & Results | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Fees & Payments | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Leave Requests | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Notice Board | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Calendar & Holidays | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Documents | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Certificates & Forms | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Uniform | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Curriculum | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Rules & Regulations | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Transport | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| Assets | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |
| ID Cards | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | V/A/E/D/P | All 20, manifest-limited | Yes |

V/A/E/D/P means View/Add/Edit/Delete/Print. “Registry available” does not mean every resource supports every transition; unsupported actions are not emitted by the manifest.

Supporting built-ins academic years, sections, subjects, users, homework acknowledgements, school, portal, diagnostics, workflows and reports have manifests/configuration roles appropriate to their area. Non-operational administrative workspaces use Setup Administration rather than ordinary workspace roles.

## D. Workspace Manager capability matrix

| Workspace | General | Main | Grid 1 | Grid 2 | Grid 3 | Layout | Actions | Relationships | Print/Branding |
|---|---|---|---|---|---|---|---|---|---|
| Students | Configurable, key protected | Configurable | Configurable | Configurable | Configurable | Configurable | Metadata configurable; adapter required | Reference metadata configurable | Configurable |
| Teachers & Staff | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Classes & Sections | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Attendance | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Time Table | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Homework | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Teacher Work Log | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Exams & Results | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Fees & Payments | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Leave Requests | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Notice Board | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Calendar & Holidays | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Documents | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Certificates & Forms | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Uniform | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Curriculum | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Rules & Regulations | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Transport | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| Assets | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |
| ID Cards | Same | Configurable | Configurable | Configurable | Configurable | Configurable | Same | Same | Configurable |

Database foreign keys, transactional rules and new operation handlers require code changes in every row; Workspace Manager safely controls presentation and bindings, not database schema creation.

## E. Exact counts

Repository factory/architecture totals:

- 30 built-in workspace definitions.
- 20 operational sidebar workspaces.
- 251 factory fields across the 20 operational workspaces.
- 285 factory action-button definitions across those 20.
- 5 normal permission kinds × 4 tabs = 20 possible normal selections per role.
- 20 special permission kinds.
- 9 workflow-oriented special permissions: Publish, Unpublish, Acknowledge, Submit, Review, Approve, Reject, Return, Cancel.
- Up to 60 dashboard components and 200 actions per workspace layout.

Current configured PostgreSQL database across three schools:

| Item | Count |
|---|---:|
| Workspace definitions | 62 |
| System workspaces | 61 |
| Custom workspaces | 1 |
| Active workspaces | 62 |
| Active configurable fields | 581 |
| Enabled sections | 81 |
| Active workspace-reference relationships | 116 |
| Layout/dashboard components | 398 |
| Action definitions | 567 |
| MAIN content assignments | 60 |
| GRID_1 content assignments | 60 |
| GRID_2 content assignments | 60 |
| GRID_3 content assignments | 60 |
| Navigation entries marked shown | 4 |
| Non-empty print configurations | 1 |
| Named workspace roles | 56 |
| Groups | 6 |
| Group memberships | 7 |
| Group-role links | 49 |
| Normalized grants | 385 |
| Universal permission selections | 16 |
| Workspace version snapshots | 483 |

A single “total configuration options” number would be misleading because the schema contains nested arrays and optional structures. The fixed workspace update surface has 13 top-level groups/properties, while each section, field, component and action contributes validated options. The reproducible factory and live counts above are the accurate totals.

## Additional evidence for the modified requirement

- schoolhub-server/src/services/workspace-numbering.ts
- schoolhub-server/src/services/workspace-layout.ts
- schoolhub-server/src/authorization/access-control.ts
- schoolhub-server/src/authorization/policy-engine.ts
- schoolhub-server/src/authorization/universal-workspace-permissions.ts
- schoolhub-server/src/routes/access-management-standard.ts
- schoolhub-server/src/routes/workspace-layouts.ts
- schoolhub-server/src/routes/workspaces.ts
- schoolhub-live-counts.json

# Admin Settings Deep Audit Addendum

This addendum treats the repository as the authority. It extends the preceding Workspace Manager and permission audit; it does not describe a proposed redesign and it does not change application behavior.

## Admin Settings Inventory

### Exact current inventory

The current implementation contains **9 Admin Settings categories** and **21 logical modules/pages**. Nineteen are declared in the base `UIA1_PAGES` frontend registry. Workspace Manager is injected by the WM2 integration, and System Diagnostics is injected only for a System Administrator. The screenshot-based list contained 18 modules; repository inspection found three additional real pages: **Settings Home**, **School Profile**, and **Academic Year**.

There is **1 parent Admin Settings route/surface** (`settings`), **21 registered page keys**, and **4 page keys that hand off to existing top-level screens** (`users`, `reports`, `portal`, and `auditlog`). Workspace Manager also retains the compatibility entry point `workspaceManager`. These are logical client routes in the monolithic application, not URL-router paths.

The audit classifies **79 literal API route registrations as Admin-facing** across the ten principal registrars used by these pages: workspaces (19), access-management-standard (16), production-authority (12), access-management (9), core API admin endpoints (7), picklists (6), workspace-layouts (4), portal-configuration (2), reports (2), and workflow-tasks (2). Those ten files contain 138 literal registrations in total; 59 ordinary operational endpoints co-located in the core `api.ts` are excluded from the Admin API total even when an Admin page previews their data.

The normalized policy manifests expose **33 distinct canonical authorization actions** across the administrative policy workspaces `access`, `school`, `portal`, `diagnostics`, `imports`, `reports`, and `workflows`. In addition, the compatibility API/UI still uses page-level strings such as `school:read`, `school:manage`, `users:view`, `users:manage`, `workspaces:view/create/configure/archive/reset`, `reports:view/print`, `workflows:view/manage`, and `audit:view`. **Setup Administration** is a global administrative role selection, not another canonical action. The two forms coexist while the access-control compatibility layer maps legacy selections to normalized grants.

The directly relevant persistence surface contains **32 database/config models**: `schools`, `academic_years`, `users`, `roles`, `role_permissions`, `password_invitations`, `access_control_settings`, `access_groups`, `access_group_memberships`, `access_group_workspace_roles`, `access_group_global_roles`, `access_roles`, `access_role_permissions`, `access_group_roles`, `access_role_grants`, `access_role_universal_permissions`, `workspace_definitions`, `workspace_sections`, `workspace_fields`, `workspace_field_options`, `workspace_definition_versions`, `workspace_permission_catalog`, `workspace_section_role_visibility`, `workspace_number_sequences`, `workspace_grid_records`, `picklist_definitions`, `picklist_values`, `exam_report_configuration`, `audit_events`, `import_jobs`, `operation_workflow_settings`, and `operation_workflow_instances`. Browser-state template/configuration objects exist in addition to these server models and are called out below.

| Category | Module | Page key / target | Purpose | Effective authority | Frontend implementation | Backend | Storage |
|---|---|---|---|---|---|---|---|
| Overview | Settings Home | `settings → home` | Configuration status and shortcuts | Admin surface visibility | `UIA1_PAGES.home`, `uiA1HomeHtml` | Reads data already loaded by other modules | Mixed server state plus browser recent-page list |
| School | School Profile | `settings → school` | Identity, contact, numbering and brand source | `school.read` / `school.manage`; Setup Administration on mutations | `UIA1_PAGES.school`; production authority panel is relocated here | `production-authority.ts` | `schools.settings` and school row |
| School | Academic Year | `settings → academics` | Create/update/archive academic years | Academic-year workspace grants; administrative mutation checks | `UIA1_PAGES.academics` | core/academic routes | `academic_years` |
| Appearance | Appearance & Navigation | `settings → appearance` | Theme, brand color, shell/navigation preferences | School settings authority; some preferences are local | `UIA1_PAGES.appearance` | production authority for school brand settings | `schools.settings`; some theme/device preferences in browser storage |
| Appearance | Login Page | `settings → login` | Tenant login branding/background | School settings authority | `UIA1_PAGES.login` | production authority settings | `schools.settings` |
| Appearance | Dashboard Defaults | `settings → dashboard` | Default dashboard experience by role | School configuration authority | `UIA1_PAGES.dashboard` | production authority settings | `schools.settings.dashboardRoleDefaults` |
| Academic Configuration | Report Card Designer | `settings → reportcard` | Report-card sections, grading and print configuration | Exam/report configuration authority | `UIA1_PAGES.reportcard` | `exam-workspace.ts` configuration routes | `exam_report_configuration` |
| Documents & Printing | Document & Form Designer | `settings → documents` | Templates for forms, certificates, letters and receipts | UI capability plus workspace/template access | `UIA1_PAGES.documents`; redirected to consolidated template library | No dedicated template CRUD authority found | Browser `state.documentTemplates`; workspace tab assignment metadata on server |
| Documents & Printing | Global Print Header | `settings → printheader` | Shared school print identity | `school.manage` / Setup Administration | `UIA1_PAGES.printheader` | production authority settings | `schools.settings.printHeaderSettings` and watermark settings |
| Workflows | Workflow Manager | `settings → workflows` | Workflow/task administration | `workflows:view/manage` compatibility keys and normalized workflow actions | `UIA1_PAGES.workflows` | `workflow-tasks.ts`; domain workflow routes | `operation_workflow_settings`, `operation_workflow_instances` |
| Users & Security | Permission Overview | `settings → permissions` | Inspect role access and permission coverage | Setup Administration / access read actions | `UIA1_PAGES.permissions` | access-management routes | normalized access tables plus compatibility roles/permissions |
| Administration | Users & Roles | `users` | Users, roles, groups and assignments | `users:view/manage`, Setup Administration, normalized access actions | External handoff from `UIA1_PAGES.users` | core API plus access-management routes | users, roles, invitations and access tables |
| Administration | Reports | `reports` | Administrative school summaries | `reports:view`; `reports:print` for print events | External handoff from `UIA1_PAGES.reports` | `reports.ts` | Live operational tables; audit event for print; no saved-report model found |
| Administration | My Portal | `portal` | Portal mode and portal feature controls | Setup Administration plus portal configure/manage compatibility | External handoff from `UIA1_PAGES.portal` | `portal-configuration.ts` | `schools.settings` portal configuration |
| Administration | Audit Log | `auditlog` | Immutable security/operation event review | `audit:view` / `audit.security_view` | External handoff from `UIA1_PAGES.audit` | `/api/v1/audit-events` | `audit_events` |
| Administration | System Diagnostics | injected `diagnostics` | Health and privacy-safe support bundle | System Administrator plus `diagnostics.view/export` | `diagnosticsNav`, `diagnosticsPane`, `openDiagnostics` | diagnostics endpoints in core API | Runtime state; support bundle is generated, not a configuration table |
| Data & System | Application Custom Fields | `settings → customfields` | Compatibility entry for old application field editor | Workspace configuration authority | `UIA1_PAGES.customfields`; retired/redirected toward Workspace Manager | workspace routes | workspace field/section models |
| Data & System | Workspace Manager | injected `workspaces` | Universal workspace metadata, layout, actions, relationships, print and permissions | `workspaces:view/create/configure/archive/reset` and normalized workspace actions | WM2 integration and `schoolHubWM2` | workspaces and workspace-layout routes | workspace models and version snapshots |
| Data & System | Picklist Manager | `settings → picklists` | Reusable option definitions and workspace-derived sources | `workspaces:view/configure` | `UIA1_PAGES.picklists` | `picklists.ts` | `picklist_definitions`, `picklist_values` |
| Data & System | Phases | `settings → phases` | Consolidated view of optional/future capability panels | Depends on the underlying capability | `UIA1_PAGES.phases` | No independent phase API | No independent phase model found |
| Data & System | Legacy Data Migration | `settings → data` | Preview and import retained browser backup data into PostgreSQL | Setup Administration and import validate/execute actions | `UIA1_PAGES.data` | core import endpoints and `ImportService` | `import_jobs` plus target operational tables |

### Architecture and navigation

`SchoolHub_School_Management_App_Complete.html` is the current parent shell. `showTab('settings')` opens Admin Settings. `UIA1_PAGES` is the base registry; each entry supplies `title`, `desc`, `cat`, `icon`, search `keys`, and optionally an `external` target. `uiA1Build` creates the rail, content panes and mobile selector. `uiA1NavHtml` groups entries by `cat` in JavaScript insertion order; no independent category registry or numeric sort field exists. `uiA1Open` shows an internal pane or calls `showTab` for an external page.

This makes navigation **frontend configuration-driven but code-defined**. It is not loaded from PostgreSQL. Module visibility is partly permission/role driven: Diagnostics is injected only when `superAdmin()` succeeds; Workspace Manager is injected by the WM2 integration and then its individual controls use permission checks. Other pages depend mainly on their handlers and backend authorization rather than a uniform page-visibility predicate. Icons are inline SVG chosen by `uiA1Icon`. The mobile navigation is built from the same registry.

There is no module lazy-loading boundary in the current monolithic HTML. Server routes are modular TypeScript registrars, imported and called by `schoolhub-server/src/routes/api.ts`; `createApp` registers that API and `server.ts` starts the application after migrations.

### Appearance & Navigation

Confirmed school-level settings include school/application identity, contact information, logo/brand source, brand color, theme, login background/overlay/subtitle, numbering prefixes, currency/year defaults, print header, watermark and dashboard role defaults. The frontend consumes them through the production-authority payload and current application state.

The visible workspace navigation configuration in Workspace Manager is persisted, but the main sidebar itself is still substantially static HTML. Therefore menu visibility/order/grouping is not universally database-driven today. Icons and Admin category placement are code-defined. Responsive behavior comes from CSS/media rules, not an administrator setting. Favicon, arbitrary default landing page, and configurable mobile navigation behavior were not confirmed as managed server settings.

### Login Page

The login editor supports tenant/school branding data, background image/configuration, positioning/overlay and subtitle text through school settings. Authentication itself remains the server session/password flow; the appearance editor does not define SSO providers. No configurable terms/privacy/help-link registry or password-reset-provider configuration was found. Branding is school-scoped because all reads/writes use the authenticated principal's `school_id`.

### Dashboard Defaults

`schools.settings.dashboardRoleDefaults` is the confirmed school-level role-default source. Workspace dashboards are separately stored in each workspace layout configuration. A complete `System → Role → Group → User` override chain is **not** implemented or demonstrated: group and user dashboard override models were not found. Browser theme/preferences can affect the local device, but they are not a server-side dashboard authority. Do not document a stronger precedence chain than the code supports.

### Report Card Designer

The report-card editor covers report configuration, assessment/grade presentation, student and school identity fields, comments/signatures, styles and print output. Its server authority is the versioned `exam_report_configuration` JSON record per school, exposed by `exam-workspace.ts`. Operational exam, marks and report-card data are separate records protected by exam workspace policies. The design configuration is school-scoped; publishing results and entering/moderating marks remain separate permissioned operations.

### Document & Form Designer

The designer supports SchoolHub templates for forms, documents, certificates and receipts; sections, fields, variables, images/signatures, headers/footers, screen/print visibility, versions and print rendering exist in the client template system. Workspace Manager can assign one form or document to a Main/Grid tab; when assigned, that template takes over the same tab content area and Section/Field creation is hidden while the assignment is active.

The important limitation is persistence authority: no dedicated server template CRUD route/table was found. Template definitions and their client-side versions are currently held in `state.documentTemplates`/browser state, while only the workspace tab assignment metadata is persisted by Workspace Manager. A future production hardening task should introduce school-scoped template tables, immutable version rows and server APIs before treating template history as centrally durable.

### Global Print Header and precedence

Global identity and header/watermark values are stored under school settings. Workspace Manager stores workspace-specific print configuration, section print visibility and template/category choices. The practical precedence is: **workspace print/layout choice for the workspace output, falling back to global school identity/header branding**. The current Workspace Manager UI explicitly notes that output continues to use global branding and that central logo/watermark assignment is deferred; therefore arbitrary per-workspace identity override is not fully implemented.

### Workflow Manager

The backend has permissioned workflow-task operations and domain-specific state machines such as leave review/approve/reject/return/cancel and publication actions. These transitions use normalized workflow actions, school/workspace scopes and audit logging. Reusable workflow definitions and policies are school-scoped JSON in `operation_workflow_settings`; durable runs are stored in `operation_workflow_instances` with a snapshot of steps and workflow version. The service protects built-in workflow identities/final system actions, validates role ownership and ordering, increments definition versions when steps change, and prevents deleting definitions already referenced by instances. Domain workflows remain limited to the registered modules and action adapters; this is a server-backed workflow engine, not an unrestricted visual automation platform.

### Permission Overview and Users & Roles

Permission Overview is primarily an inspection/matrix surface. Actual modification occurs through Users & Roles/access-management operations. The model covers users, legacy roles, normalized roles, groups, memberships, group-to-global-role links, group-to-workspace-role links, explicit grants, universal selections, workspace tabs, actions and special permissions. System Administrator bypass/effective grants are derived on the backend; other roles/groups are constrained by stored grants and scope. Backend checks remain mandatory even when a button is hidden.

User administration supports create/invite, edit/status management, role/group assignment and access configuration. Password invitation tokens are hashed and expire. The dominant destructive lifecycle is disable/archive rather than silent hard deletion; where permanent deletion exists it is a distinct normalized action and must not be inferred from an ordinary Delete label.

### Reports

Admin Reports is a live reporting surface over students, attendance, fees, academic performance and low-attendance summaries. It supports server-side filters and print authorization/auditing. No durable saved-report definition, scheduled-report job, arbitrary query builder or report-sharing model was found in this Admin page. It must not be confused with a workspace's configurable Dashboard or report-card designer.

### My Portal

The confirmed server configuration is school-scoped portal mode and module/feature controls, including Off/ReadOnly/Pilot style rollout, portal modules, teacher features and PWA-related flags. It is enforced through portal configuration services and permission checks. Separate per-role menu/widget builders, user-specific portal layouts and independent portal branding models were not confirmed.

### Audit Log

`audit_events` stores school, actor, action, entity type/id, occurrence time, outcome, reason code, correlation ID and JSON summary. Authentication successes/failures, password and user administration, meaningful record mutations, prints, configuration operations and security changes write through `writeAudit` where implemented. The API is school-scoped and paginated. IP/user-agent are available to session/authentication handling but are not columns in `audit_events`; before/after values appear only when a caller includes them in `summary`. No configurable retention or generic audit export endpoint was confirmed.

### System Diagnostics

Diagnostics exposes application/database health and privacy-safe support-bundle preview/export. The UI also consolidates migration, scope/rollout and server-authority compatibility panels. Access is restricted to System Administrator and backed by diagnostics view/export actions. It does not expose unrestricted secrets. Queue, cache, mail and background-job health are not independent confirmed diagnostic subsystems and should not be claimed.

### Application Custom Fields

The old application-level custom-field editor is a compatibility/retired surface. The authoritative implementation is workspace fields: stable field keys, types, validation/configuration, required/default behavior, options/picklists, list/search/filter/export/print visibility, relationships and section placement are stored in workspace tables. Existing system fields remain protected; safe presentation properties and custom fields are configurable. Record values are stored in the corresponding operational record/custom-values structure, not in the field-definition row itself. Deletion/retirement must respect factory protection and dependencies.

### Workspace Manager

The complete audit earlier in this report is authoritative. The current detail UI contains General, Main Tab, Grid Tab 1, Grid Tab 2, Grid Tab 3, Layout, Action Buttons, Relationships and Print & Branding, plus navigation/numbering configuration, history, preview and reset capabilities. The server stores definitions, fields, sections, relationships, action definitions, layouts, tab assignments, versions and permission catalog data. UI controls and runtime action adapters are separate responsibilities: a configured button still requires an implemented, authorized backend operation.

### Picklist Manager

Picklists have school-scoped definitions and stable value keys, labels, colors, ordering and active/inactive state. Sources can be administrator-defined or workspace-derived; current workspace-derived sources are Students, Staff and Classes. System values are protected. Existing values are deactivated rather than physically removed so records do not lose historical meaning. No general localization table, parent-child dependency engine or arbitrary workspace source registry was confirmed.

### Phases

Phases are a UI grouping for optional/future capabilities and legacy rollout panels. Repository evidence does not show a `phase` domain table, ordered phase instances, transition engine or dedicated phase permission model. It must not be described as an operational workflow object merely because of its name.

### Legacy Data Migration

The implemented import path accepts the application's retained JSON backup format, performs preview/validation, calculates a backup hash for duplicate protection, and commits through `ImportService`/transactions into tenant-scoped tables. `import_jobs` records status/counts and prevents repeat import of the same backup per school. Generic CSV/Excel mapping, background queue processing and a generic rollback endpoint were not found. Commit is potentially destructive because it writes many records; it requires administrative import authority, preview/validation and audit coverage. Recovery is database backup/transaction/version dependent rather than a one-click import rollback.

## Admin Settings Permission Model

The table reports the actual control style. A dash means no independent operation of that name was confirmed; it does not mean the page is public.

| Admin module | View | Configure/Create/Edit | Delete/archive | Special authority |
|---|---|---|---|---|
| Appearance & Navigation | school read / Admin surface | school manage / Setup Administration | — | Some device-local preferences |
| Login Page | school read | school manage / Setup Administration | — | School-scoped branding |
| Dashboard Defaults | school read | school manage / Setup Administration | — | Role-default configuration |
| Report Card Designer | exam/report view | exam report configuration update | — | Marks/results permissions stay separate |
| Document & Form Designer | template/workspace view | client designer plus workspace configure | archive/reset in client model | Server template authority is incomplete |
| Global Print Header | school read | school manage / Setup Administration | — | Workspace print config may refine layout |
| Workflow Manager | workflows view / record view | workflows manage; workspace configure; workflow actions | archive when resource policy permits | submit/review/approve/reject/return/cancel |
| Permission Overview | access read / Setup Administration | Modification occurs in Users & Roles | — | security-audit view |
| Users & Roles | users view; access roles/groups read | users manage; roles/groups/grants/memberships manage | status/archive paths | access preview; Setup Administration |
| Reports | reports view | report create/share where policy supports it | — | report export; print |
| My Portal | portal view | portal configure | — | rollout mode restrictions |
| Audit Log | audit view | — | immutable | security audit view |
| System Diagnostics | diagnostics view | — | — | diagnostics export; System Administrator only in UI |
| Application Custom Fields | workspace view | workspace configure | protected archive/delete rules | retired entry redirects to Workspace Manager |
| Workspace Manager | workspaces view / record view | create/configure | archive/restore; factory reset separately | permission catalog and universal actions |
| Picklist Manager | workspace view | workspace configure | deactivate values | system values protected |
| Phases | underlying panel authority | underlying panel authority | — | no standalone phase permission |
| Legacy Data Migration | import validate | import execute | — | Setup Administration; duplicate-hash guard |

## Admin Settings Dependency Map

- **School Profile** → login branding, application identity, print header, numbering defaults, currency/year, dashboard role defaults.
- **Academic Year** → students/classes, attendance, timetable, homework, exams, fees and workspace filters.
- **Users & Roles** → groups, memberships, normalized grants, workspace access, action-button visibility, workflow actions, diagnostics and audit access.
- **Permission Overview** → reads the same access/role/group/workspace permission authority used by backend enforcement.
- **Workspace Manager** → workspace fields, sections, tab assignments, dashboards, actions, relationships, navigation metadata, numbering, print configuration, picklists and version history.
- **Picklist Manager** → workspace field options, forms/filters and historical record labels.
- **Document & Form Designer** → workspace tab assignment and print output; global print identity supplies shared branding.
- **Workflow Manager** → users/roles/groups, workspace resources, domain state transitions and audit events.
- **Report Card Designer** → academic year, subjects, exams, marks, student data, school identity and printing.
- **Reports** → operational tables, permissions and print audit.
- **My Portal** → users/roles, rollout mode and operational module visibility.
- **Legacy Data Migration** → school scope, target tables, validation, deduplication and audit.

## Global and workspace configuration scope

| Configuration | Scope | Confirmed override/precedence |
|---|---|---|
| Application shell code and Admin categories | Application build | Code-defined; no tenant override |
| School Profile, login brand, global print identity | School/tenant | School row/settings are authoritative for authenticated school |
| Dashboard role defaults | School + role key | School setting by role; no confirmed group/user hierarchy |
| Workspace fields/tabs/layout/actions/relationships/print | Workspace within school | Workspace config overrides factory/default presentation; factory reset restores protected defaults |
| Role/group grants | School + role/group + optional workspace/resource scope | System Administrator backend bypass/effective authority; otherwise normalized grants/scopes |
| User theme/recent Admin pages | User device/browser | Local only; not a tenant policy |
| Report-card design | School | One versioned configuration record per school |
| Portal configuration | School | Mode and module flags apply to that tenant |
| Picklists | School, optionally consumed by workspace fields | Stable option values remain historical when inactive |

Every server query/mutation inspected carries or derives `school_id`. A UI-only setting cannot expand backend authority.

## Configuration Safety

| Sensitive operation | Guard | Confirmation/validation | Audit/history/recovery |
|---|---|---|---|
| Workspace factory reset | `workspaces:reset`, system workspace check | Reset preview/confirmation path | Workspace versions; factory definition recovery |
| Workspace/record archive | archive grant and scope | dependency/version checks where implemented | audit event; restore action when policy supports it |
| Permanent delete | distinct `record.permanent_delete` grant | Must use a dedicated adapter and confirmation; ordinary Delete maps to archive in legacy compatibility | Audit required; no universal undo |
| Role/group/grant changes | Setup Administration and access-manage actions | schema, tenant and grant-definition validation | access audit/version fields where implemented |
| Field/section removal | workspace configure; system protection | dependency/factory checks | workspace definition versions/reset |
| Picklist removal | workspace configure | system-value protection; deactivate instead of hard delete | historical keys retained |
| Workflow transition/configuration | workflow action/scope | state and assignee checks | workflow/domain audit trail |
| Legacy import commit | import execute + Setup Administration | preview, schema validation, transaction, backup-hash dedupe | `import_jobs` and audit; external DB recovery for rollback |
| Navigation change | workspace configure | schema validation | stored workspace version; main sidebar still code-defined |

## Can Admin Settings categories be extended?

Yes, by changing code. A category is created when a new `UIA1_PAGES` entry uses a new `cat` string; `uiA1NavHtml` groups it automatically. Category label, order, hidden state and permission visibility are not database-configurable. Category order follows the first occurrence in object insertion order. A module moves categories by changing its `cat`; a module moves within a category by changing registry insertion order. Only injected modules currently perform explicit runtime role checks at navigation construction. A safer future refactor would add a typed registry with `order`, `permission`, `featureFlag`, `scope`, and `loader` fields, but that is a proposed improvement and is not the current implementation.

## Admin Settings Developer Extension Guide

This procedure follows the current repository architecture for an example **Admin Settings → Data & System → Notification Templates** module.

1. **Choose the authority and scope first.** Decide whether notification templates are application-global or school-scoped. SchoolHub operational configuration should normally be school-scoped. Define the stable module key (`notificationTemplates`), API resource (`notification-template`), canonical actions and data-retention/version rules before building UI.

2. **Create the frontend page.** The current Admin shell lives in `SchoolHub_School_Management_App_Complete.html`. Add a `UIA1_PAGES.notificationTemplates` entry with `title`, `desc`, `cat: 'Data & System'`, icon/search keys and no `external` value for an internal pane. For maintainability, put substantial behavior in a focused file under `Server_Module_Completion/notification-templates.js` and load it through the same script assembly pattern used by the other server-completion modules; keep only registration/mount glue in the monolith.

3. **Register navigation and ordering.** Place the registry entry after the intended Data & System neighbor. Current order is insertion order. `uiA1Build` creates `uia1Pane-notificationTemplates`, the rail item and mobile option automatically. If the module is injected after initial build, follow `integrateSettings`/`diagnosticsNav`: create the pane, add rail and mobile entries, and make the operation idempotent.

4. **Add visibility enforcement.** The current base registry lacks a uniform `permission` property, so do not rely only on the menu. Add a permission check when rendering/injecting the item and again inside its open handler. Hiding the item is convenience; it is not authorization.

5. **Define normalized permissions.** Add a `notification-templates` workspace/resource manifest in `schoolhub-server/src/authorization/policy-registry.ts`, using stable actions such as `record.view`, `record.create`, `record.update`, `record.archive`, and any narrowly named special action. Add any compatibility permission strings only if an existing client/API contract requires them, in `schoolhub-server/src/authorization/permission-catalog.ts`. Update seed/migration logic so the System Administrator receives effective authority and ordinary roles receive nothing until assigned.

6. **Design persistence.** For a substantive versioned template, create dedicated school-scoped tables rather than adding an opaque browser object. A suitable design is `notification_templates` plus immutable `notification_template_versions`, each with `school_id`, stable key, status, version, audit columns and unique constraints scoped to the school. Add SQL through the migration mechanism in `schoolhub-server/src/database/migrations.ts` (or a dedicated schema function invoked by it). Use `schools.settings` only for a small singleton preference with no independent lifecycle.

7. **Add the backend route registrar.** Create `schoolhub-server/src/routes/notification-templates.ts` exporting `registerNotificationTemplateRoutes(app, db, config)`. Use Zod `.strict()` schemas, the existing authentication pre-handler, authenticated principal, school-scoped queries, optimistic `version` checks, normalized authorization helpers and `ApiError` conventions.

8. **Register the API.** Import and call `registerNotificationTemplateRoutes` in `schoolhub-server/src/routes/api.ts` beside the other Admin registrars. The application entry remains `schoolhub-server/src/server.ts` → `createApp` → `registerApi`; no second server or unprotected route tree should be introduced.

9. **Enforce authorization on every endpoint.** Map list/get to view, create to create, patch to update, archive/restore to their explicit actions and any publish/send operation to its own special action. Resolve access with the policy engine and current `schoolId`; never trust a client-supplied school ID or button visibility.

10. **Write audit events.** Wrap mutations in a database transaction and call `writeAudit` with actor, school, stable action, entity type/id, outcome, correlation ID and a non-sensitive summary. Log permission/configuration changes and send/publish operations. Do not put template secrets or recipient data into audit summaries.

11. **Connect the frontend to server authority.** Load records from `/api/v1/notification-templates`, display only authorized commands, send CSRF-protected mutations, surface validation/version conflicts, and refresh from the server after success. Do not make `localStorage` the authoritative template store.

12. **Add tests.** Add unit tests for schema/service behavior under `schoolhub-server/tests/unit` and integration tests under `schoolhub-server/tests/integration`. Cover System Administrator access, denied ordinary role, assigned role success, cross-school isolation, create/update/archive/restore, stale version, invalid input, audit creation and navigation visibility. Run the server test/build commands already defined in `schoolhub-server/package.json`.

13. **Verify school isolation.** Every select/update/delete predicate must include `school_id`; foreign keys and uniqueness constraints must preserve tenant scope. Test with two schools and deliberately reuse template keys/IDs where safe to prove no cross-school read or mutation.

14. **Deploy safely.** Apply the additive migration before enabling the UI, seed only protected defaults, retain old data, and use an explicit feature flag if staged rollout is needed. Verify the Admin entry as System Administrator and as an unassigned role. The current Admin registry has no general feature-flag field, so a flag must be checked in both navigation rendering and API/service execution.

### Developer checklist

| Concern | Required repository location/pattern |
|---|---|
| Page key, label, icon, category, order | `UIA1_PAGES` in `SchoolHub_School_Management_App_Complete.html` |
| Large frontend behavior | focused script in `Server_Module_Completion/`, mounted from Admin pane |
| Route registrar | new `schoolhub-server/src/routes/*.ts` module |
| API registration | import/call in `schoolhub-server/src/routes/api.ts` |
| Validation | Zod strict schemas in route/service boundary |
| Permission manifest | `schoolhub-server/src/authorization/policy-registry.ts` |
| Compatibility permission, only if needed | `schoolhub-server/src/authorization/permission-catalog.ts` |
| Database migration | `schoolhub-server/src/database/migrations.ts` or invoked schema module |
| Tenant isolation | `school_id` in schema, unique constraints and every query/mutation |
| Audit | `schoolhub-server/src/audit/service.ts` via `writeAudit` |
| Tests | `schoolhub-server/tests/unit` and `schoolhub-server/tests/integration` |

### Known gaps and recommended follow-up

1. Move the 19 base pages and two injected pages into one typed Admin registry carrying order, icon, permission, feature flag, route type and loader.
2. Persist Document/Form templates on the server with immutable versions; current browser-state authority is insufficient for multi-user administration. Workflow definitions are already server-backed, but immutable definition-version rows would strengthen historical reconstruction beyond instance snapshots.
3. Make the operational sidebar consume Workspace Manager navigation metadata; persistence exists but the sidebar remains substantially static.
4. Add explicit server models only where needed for saved/scheduled reports, audit retention/export, portal role layouts, picklist dependencies/localization or dashboard group/user overrides. None should be documented as existing until implemented.
5. Keep System Administrator backend authority automatic, but continue enforcing every non-administrator role/group through normalized grants and scopes.

## Admin Settings evidence index

- `SchoolHub_School_Management_App_Complete.html`: `UIA1_PAGES`, `uiA1NavHtml`, `uiA1Open`, `uiA1Build`, WM2 `integrateSettings`, `diagnosticsNav`, `openDiagnostics`.
- `schoolhub-server/src/server.ts` and `schoolhub-server/src/routes/api.ts`: application/API composition.
- `schoolhub-server/src/routes/production-authority.ts`: school, appearance, login, print and dashboard-default authority.
- `schoolhub-server/src/routes/access-management.ts` and `access-management-standard.ts`: roles, groups, memberships, grants and settings.
- `schoolhub-server/src/routes/workspaces.ts` and `workspace-layouts.ts`: Workspace Manager persistence and layouts.
- `schoolhub-server/src/routes/picklists.ts`: picklist definitions/values.
- `schoolhub-server/src/routes/exam-workspace.ts`: report-card configuration.
- `schoolhub-server/src/routes/portal-configuration.ts`: portal modes/features.
- `schoolhub-server/src/routes/reports.ts`: Admin report data/print authority.
- `schoolhub-server/src/routes/workflow-tasks.ts`: durable workflow tasks.
- `schoolhub-server/src/authorization/policy-registry.ts`, `permission-catalog.ts`, `access-control.ts`, and `policy-engine.ts`: permission authority and scope resolution.
- `schoolhub-server/src/database/migrations.ts` and `operations-workflows-schema.ts`: persistence models.
- `schoolhub-server/src/audit/service.ts`: audit writes.

