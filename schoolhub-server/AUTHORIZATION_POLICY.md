# SchoolHub server authorization policy

## Current implementation status

SchoolHub has one server-side authorization vocabulary: `workspaceKey + resourceType + action + scope + constraints`. The policy registry rejects unknown combinations, the policy engine evaluates complete grants, and migration 40 adds normalized grant storage. The exact `System Administrator` role is the recovery authority; substring/name-based administrator detection is forbidden.

The rollout mode values remain for diagnostics and audit history, but they do not restore legacy authorization. Runtime authority always comes from active User -> Group -> named Workspace Role -> normalized grants. The exact `System Administrator` role remains the recovery authority.

Homework is the reference implementation. Its collection, record, create/update, lifecycle, acknowledgement, and attachment paths call the central engine when access control is Enforced. Other existing route permissions are registered and fail closed when unknown, but their record-level adapters must be migrated and verified before global Enforced rollout.

## Grant model

A grant is indivisible:

- workspace: the application area;
- resource: the protected record type;
- action: the operation;
- scope: the records to which it applies;
- constraints: lifecycle, sensitivity, and field limitations;
- provenance: role/group source for audit and explanation.

An action from one role cannot be combined with a scope from another role. `ALL_WORKSPACE` means all records inside that workspace, subject to lifecycle and sensitivity constraints. It does not mean all schools or all resources.

## Workspace migration contract

Every workspace must provide all of the following before it is marked authorization-complete:

1. Register each resource, action, and allowed scope in `src/authorization/policy-registry.ts`.
2. Map every list/search/detail response to a `RecordSecurityContext`; filter lists before pagination totals are calculated.
3. Authorize create against the proposed target context and authorize update against both current and proposed contexts.
4. Model concrete relationships: owner/creator, direct assignee, concrete recipients, group, class, section, academic year, subject, teaching assignment, student, guardian-child link, department/house/route/hostel when applicable.
5. Keep class and section scopes exact. A broad OR across unrelated relationships is forbidden.
6. Declare lifecycle and sensitivity values (draft, published, archived, deleted, confidential, internal notes) and enforce constraints.
7. Enforce field read/write rules on the server. Hidden UI fields are not security.
8. Apply the parent record decision to attachments, print/export, audit history, bulk actions, imports, reports, notifications, and background jobs.
9. Return server-derived capabilities for UI enablement; never authorize from a browser flag or hard-coded account-role name.
10. Add positive and negative tests for cross-school, cross-class, cross-section, unassigned-teacher, unrelated-guardian, draft/archived/confidential, attachment, print/export, and privilege-escalation cases.

## Workspace work still required

Record-level adapters are still required for Students, Staff, Classes/Sections/Subjects, Attendance, Timetable, Exams/Marks/Report Cards, Fees, Leave, Notices, Calendar, Documents, Certificates, Uniform, Curriculum, Rules, Transport, Teacher Work Logs, Reports, Workflows, Assets, ID Cards, Picklists and custom workspaces. Their current endpoint permissions remain registered, but some handlers still contain relationship-specific compatibility code.

The access-management API exposes the canonical permission catalog, per-workspace action/scope catalog, normalized grants, provenance and effective access. It synchronizes every built-in workspace before returning the UI model, including Subjects and Users. Compatibility permission selections may be accepted only as input and converted into complete normalized grants; legacy permission tables and direct workspace-role assignments are never consulted by runtime authorization.

## Safe rollout

1. Apply migration 40 through the normal migration command in a controlled environment.
2. Review each Group and named Workspace Role; never bulk-convert ambiguous legacy roles without human review.
3. Keep the exact `System Administrator` recovery account verified.
4. Migrate and test record-level route adapters one workspace at a time, starting with Homework.
5. Use the generated workspace matrix to record both an allow and a deny case before marking a workspace complete.
6. Treat Preview/Audit/Rollback labels as reporting state only; they do not reactivate legacy authorization.