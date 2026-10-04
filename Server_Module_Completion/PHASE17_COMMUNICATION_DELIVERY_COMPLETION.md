# Phase 17: Controlled communication delivery

Completed: 2026-09-16

Phase 18 payment work remains deferred and unchanged. Phase 19 examination logistics remains intact.

## Delivered

- Tenant-level Communication Delivery controls in Admin Settings; every capability defaults OFF.
- Reusable communication templates with audience defaults.
- Campaigns for All, Students, Parents or Teachers, resolved from active authoritative portal-user relationships.
- Real in-app inbox delivery with read timestamps and required acknowledgements.
- A direct Messages action for authenticated portal users; campaign and template management remains restricted to authorized Notice administrators.
- Email, SMS, WhatsApp and Web Push outbox channels with explicit provider status.
- Scheduled campaigns and an authorized due-queue dispatch action.
- Per-recipient/channel delivery history, attempt counts, error codes and retry controls.
- Existing notices can be linked to campaigns without changing the Notice Board authority or attachments.

## Honest external-delivery boundary

No external provider credentials are configured in this installation. Email, SMS, WhatsApp and Web Push therefore create auditable `Blocked` delivery records with `PROVIDER_NOT_CONFIGURED`; they never claim a successful delivery. In-app delivery is the only active transport implemented in this phase.

## Administration and safety

- Master switch and independent channel, scheduling, acknowledgement and retry switches.
- Configuration requires `school:manage` and `notices:update`.
- Templates/campaigns reuse existing Notice permissions; inbox rows are restricted to the authenticated user.
- Mutations are authenticated, CSRF-protected, tenant-scoped, validated, version-aware and audited.
- Acknowledgements require in-app delivery; disabled channels cannot be selected by an API client.

## Schema 33

- `communication_delivery_configuration`
- `communication_templates`
- `communication_campaigns`
- `communication_deliveries`

The migration is additive. Existing notices, calendar links, attachments and publication states are unchanged.

## Verification

- TypeScript production build: passed.
- Phase 17 JavaScript syntax: passed.
- Migration ordering/idempotency: passed.
- Focused Phase 17 integration tests: 3 of 3 passed, including portal-only inbox isolation.
- Combined full backend regression: 35 files, 133 tests passed.
- Current browser asset/startup gate: 11 of 11 passed.

## Rollout

Existing schools remain default-off after migration. An administrator must explicitly enable Communication Delivery and each approved channel under Admin Settings. Provider adapters and secrets must be implemented/configured before an external channel can move beyond Blocked status.

Verified pre-migration backup: `backups/schoolhub-pre-migration-20260916-121701.dump` (2,257,458 bytes).

SHA-256: `51F98FE6009547F3268B6A3C911BF29F037BCA361F9674D078B0EBC9686D2D2B`.
