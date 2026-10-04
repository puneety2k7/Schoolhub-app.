# Backend contributor rules

The repository-level preservation rule remains mandatory: do not remove, disable, replace, or add behavior without explicit approval.

For every new or changed workspace endpoint:

- Use the central authorization registry and policy engine. Do not invent a second role/permission system.
- Declare `workspaceKey`, `resourceType`, action, allowed scopes, lifecycle/sensitivity rules, and security metadata.
- Authorization must be server-side and fail closed. Do not authorize by username, account-role substring/name, browser state, or UI visibility.
- Use concrete relationships and one complete grant. Never combine an action from one grant with a scope from another.
- Authorize lists, individual records, current and proposed update state, attachments, exports/prints, audit, bulk/import/background work, and capabilities.
- Preserve exact `System Administrator` recovery behavior; do not add another bypass.
- Keep rollout staged until grants and negative tests are reviewed. Never silently switch a school to Enforced.
- Add focused allow/deny tests, including cross-school and cross-scope cases.

See `AUTHORIZATION_POLICY.md` for the workspace migration contract.