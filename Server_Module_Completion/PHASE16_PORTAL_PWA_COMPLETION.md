# Phase 16: Admin-controlled portals and PWA

Completed: 2026-09-16

## Delivered

- A new Admin Settings panel controls the tenant portal and PWA configuration.
- All Phase 16 capabilities default to OFF. The server environment rollout mode is an upper safety bound, so a tenant setting cannot enable a mode that operations has disabled.
- Admins can select Off, Read Only or Pilot access and independently control student/parent portal modules and teacher attendance, homework, marks and work-log actions.
- Admins independently control PWA availability, the install prompt and the offline application shell.
- Disabling PWA removes the manifest, install control, service-worker registration and shell cache.

## Authority and safety

- Portal configuration requires `portal:manage`.
- Mutations require authentication, CSRF validation, schema validation and the current configuration version.
- Configuration is stored inside the existing school settings document, preserving unrelated settings, and every successful change creates an audit event.
- Portal read models receive the enabled module map. Teacher mutations independently re-check effective Pilot mode and their matching admin switch on the server.
- The offline service worker caches only static application-shell files. Requests under `/api/` are always network-only and school/business data is never placed in the offline cache.

## Verification

- TypeScript production build: passed.
- Full server regression: 33 files, 128 tests passed.
- Phase 15/current browser gate: 11 of 11 passed with no uncaught or resource errors.
- Phase 16 JavaScript syntax and web manifest parsing: passed.

## Deliberate boundary

The control plane contains switches for the broader portal roadmap, but a switch does not manufacture a read model. Attendance, homework, results and fees are the current student/parent portal read models. Additional portal views must be implemented and permission-tested before they are treated as delivered functionality. All remain default-off until an administrator explicitly enables them.
