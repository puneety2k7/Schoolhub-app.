# Phase 20: Assets and digital ID cards

Prepared: 2026-09-16

Phase 18 payment-gateway work remains deliberately deferred and unchanged. Phases 17 and 19 remain intact.

## Delivered

- Tenant-level Phase 20 controls in Admin Settings; the master switch and every sub-capability default OFF.
- Independent controls for the asset register, assignments/returns, maintenance, digital cards, bulk issuance, replacement cards and public token verification.
- Categorized asset register with school-scoped asset numbers, serials, acquisition values, condition, location and status.
- Transactional student/staff assignment and return workflows that prevent double assignment and preserve condition history.
- Maintenance open/complete lifecycle that prevents assigned or already-maintained assets from entering conflicting workflows.
- Student/staff digital-card templates with controlled colors, orientation, photo and validity presentation settings.
- Single and bulk issuance, school-scoped card numbering, active-card duplicate protection, revocation and traceable replacement.
- Self-service card lookup for linked student and teacher portal identities.
- High-entropy verification tokens returned only at issuance; only SHA-256 digests are stored.
- Public verification returns a minimal holder snapshot and is unavailable unless the administrator explicitly enables verification.

## Administration and safety

- Configuration requires `school:manage`.
- Asset access uses `assets:view` and `assets:manage`; card access uses `idcards:view`, `idcards:manage` and `idcards:print`.
- Every mutation is authenticated, CSRF-protected, tenant-scoped, strictly validated and audited.
- Configuration, asset, assignment, maintenance and card state transitions use optimistic version checks or row locks.
- Bulk issuance is confirmation-gated, capped at 500 active holders per request and skips holders who already have an active card.
- Existing student, staff and portal records remain authoritative. Issued cards preserve a non-editable holder snapshot.

## Schema 34

- `specialist_operations_configuration`
- `asset_categories`
- `school_assets`
- `asset_assignments`
- `asset_maintenance_records`
- `id_card_templates`
- `id_card_issues`
- `id_card_number_counters`

The migration is additive. Existing schools remain default-off and receive no Phase 20 records automatically.

## Verification

- TypeScript production build: passed.
- Phase 20 browser JavaScript syntax: passed.
- Focused Phase 20 integration tests: 2 of 2 passed.
- Full backend regression: 36 files, 135 tests passed.
- Current asset-aware browser gate: 11 of 11 passed with schema 34 and no startup/resource errors.

## Deployment status

The code and migration are release-ready. Live schema migration and service restart require explicit approval because they create a database backup, mutate the live database to schema 34 and briefly restart SchoolHub services.
