# Transport workspace completion — 16 September 2026

Standard Transport UI: PASS
Right-side drawer: PASS
Vehicle source: `transportVehicle` Picklist. No vehicle/bus master table exists; initial values reuse distinct existing route vehicle strings.
Driver source: Teachers & Staff record IDs (`staff.id`).
Attendant source: Teachers & Staff record IDs (`staff.id`).
Shift source: `transportShift` Picklist.
Status source: `transportStatus` Picklist.
Class/Section source: Existing `classes.id` and `sections.id` references; multiple selection and section-to-class validation.

Existing Picklists reused:
- None matched Transport semantics in the inspected live catalog. Other modules' similarly named Active/Inactive lists were deliberately not reused.
- Existing route vehicle values were reused when initializing the vehicle list; no vehicle master records were fabricated.

New Picklists created:
- `transportStatus`: route operational status, distinct from Student/Class/Document status.
- `transportShift`: Morning, Afternoon, Both; no equivalent list existed.
- `transportVehicle`: controlled vehicle registrations, because no vehicle master exists.

Duplicate Picklists created: NO
Workspace References used: driverId/attendantId → Staff; classIds → Classes; sectionIds → Sections; studentId → Students; routeId → Transport.
Status colors inherited from Picklist Manager: YES
Student transport assignments preserved: YES
Delete/Archive safety: PASS
Console/API errors: PASS — focused isolated sanity checks completed without unexpected errors; expected negative-validation API responses were tested separately.

## Implemented

- Summary cards, compact search/status/vehicle/shift filters, pagination, archived-record filter, mobile cards.
- Add/Edit right drawer, detail drawer, shared print-engine content, Archive and Super Admin Restore.
- Route name/code, vehicle, staff references, structured stop rows (name/pickup/drop time; array order is sequence), start time, shift, monthly fee, capacity, class/section references, status and notes.
- Required-field, same-school reference, route-code duplication, capacity, class/section and pickup/drop validation.
- Existing assigned stop names cannot be removed by editing a route.
- Archive retains route rows, vehicle data, student assignments and stop history. It blocks new assignment to archived routes. No hard-delete endpoint added.
- Workspace Manager remains intact. Factory 12 registers the actual Transport fields and existing sources. Obsolete system fields number/driver/phone/active are archived in metadata rather than deleted; persisted route data remains unchanged.
- Workspace labels, field visibility/read-only metadata and print/archive behavior are used by the Transport UI. Existing custom metadata was not reset.

## Exact storage and compatibility

No new database schema migration: schema remains 31.
Existing `transport_routes(id, school_id, data jsonb, archived, version, created_at, updated_at)` retained.
Existing `transport_assignments(school_id, student_id, route_id, pickup_stop, drop_stop, version, updated_at)` retained.
Route JSON retains `route, vehicle, driver, attendant, stops, status` and adds:
`routeCode, driverId, attendantId, stopDetails[{name,pickupTime,dropTime}], startTime, shift, monthlyFee, capacity, classIds[], sectionIds[], notes`.
Structured stops also maintain the existing comma-separated `stops` representation for assignment compatibility.
IDs are stored for staff/classes/sections/students/routes; vehicle, shift and status use stable Picklist values.
Staff and class/section names resolve from their same-school master records. Picklist labels/colors resolve from Picklist Manager.

Legacy driver/attendant text is retained until explicitly linked to real staff; no guessed matches or duplicate staff were created. The inspected staff records were Teachers, so appropriate driver/attendant staff records must be configured by the school if needed.
Existing routes lacking new fields are not filled with invented values; users supply these when editing.
Legacy Local/Browser-data Transport behavior is unchanged. This phase upgrades Server mode.
No fleet-management subsystem, driver licensing, fuel/ownership lists, stop fee adjustments, automatic student reassignment or unrelated module redesign was added.

## Verification

- TypeScript build and Transport JS syntax: PASS.
- Focused Transport API integration test: PASS (reference validation, stop safety, stale versions, assignments, archive retention, restore).
- Isolated browser check: PASS (open, drawer, add, edit, view, print-content handoff, student assignment, archive, restore, desktop/mobile, no console errors).
- Print uses the existing `printWindow` engine; the test verifies the content passed to that engine, not physical printing.
- Desktop/mobile screenshots reviewed in `output/transport-sanity`.
- No full regression performed.

## Deployment and safety

Backup: `backups/schoolhub-before-transport-ui-2026-09-16T03-48-24-156Z.dump`
Backup SHA256: `e32580d655efbc4b874a800736a5d33c7f6271b3427f9b455257afc2179986a0`
Backup directory listing verified with pg_restore before metadata synchronization.
Existing route and assignment rows compared before/after and unchanged. Existing 22 Picklist definitions and 124 values retained. Other business-record counts unchanged.
API restarted with tested build; live health and Transport asset verified.

