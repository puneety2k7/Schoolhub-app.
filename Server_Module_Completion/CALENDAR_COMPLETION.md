# School Calendar & Holidays — 2026-09-16

Deployed schema 29 / Workspace factory 10. Refresh with Ctrl+F5.

## UI

| Check | Result |
|---|---|
| Reference UI followed using existing SchoolHub styles | PASS |
| Real summary counts | PASS |
| Month view | PASS |
| Agenda | PASS |
| Week / Day | PASS — simple date-based views |
| Right-side Add/Edit drawer, independent scroll, fixed footer | PASS |
| View | PASS |
| Edit with prefilled values | PASS |
| Event / Month print via existing branded engine | PASS |
| Archive / preloaded holiday hide and restore | PASS |
| Mobile agenda cards / full-width drawer | PASS |

Counts describe the selected month and type filter, including existing generated holidays, with no fabricated trends. Activities counts non-holiday, non-exam events. Inactive/Cancelled records remain visible with status rather than disappearing silently.
Month print is a dated monthly event table with school branding, academic year and event-type legend.

## Audience

Multiple selection: PASS.
All / Teachers / Students / Parents / Staff: PASS.
Class targeting: PASS — classId reference.
Section targeting: PASS — sectionId reference validated against classId.
Individual targeting: supported through teacherId and/or studentId.
All is exclusive in the UI and API. At least one audience is required.
Targeting is stored calendar context; no email, SMS or new recipient-delivery system was introduced.

## Workspace Manager

Calendar workspace registered: YES, calendar-holidays.

| Field | Type |
|---|---|
| Event Title | text |
| Event Type | singleSelect |
| Category | singleSelect |
| Start Date / End Date | date |
| Start Time / End Time | time |
| All Day | boolean |
| Description | longText |
| Audience (audiences) | multiSelect |
| Related Class / Section / Teacher / Student | workspaceReference |
| Attachment | file |
| Status | singleSelect |
| Mark as Holiday | boolean |
| Holiday Type | singleSelect |
| Tentative / Lunar / Hidden | system boolean |
| Linked Notice / Created By | workspaceReference |
| Created At / Updated At | dateTime |

Native time was added to the existing supported field-type registry. Old date/audience/text metadata is retained for compatibility and administrator customization; the new operational Audience field is audiences, not the legacy scalar audience.
Category remains distinct: Event Type describes the activity (e.g. Meeting); Category describes classification (e.g. Academic, Religious, National). Historical categories are preserved, including Computed and Lunar / lunisolar.

## Picklists

All five integrations: PASS.
- calendarEventType: Holiday, Exam, Meeting, Activity, Sports, Cultural Event, Workshop, Reminder, Other; existing School Activity, PTM and Event retained.
- calendarCategory: National, Religious, Academic, Administrative, Cultural, Sports, Other; legacy Other fixed-date, Computed, Lunar / lunisolar, State and Imported retained.
- calendarStatus: Active, Inactive, Cancelled.
- calendarAudience: All, Teachers, Students, Parents, Staff, Class, Section, Individual.
- calendarHolidayType: National, Religious, School Holiday, Local Holiday, Optional Holiday.

Existing stored type/category labels are added only when missing; configured values are not overwritten.

## Exact storage and references

Existing school_calendar_events unchanged:
school_id text FK schools; id text; data jsonb; hidden boolean; notice_id text FK school_communications; version integer; primary key(school_id,id).

Operational JSON:
title, type, category, from, to, startTime, endTime, allDay, description, audiences[], classId, sectionId, teacherId, studentId, status, isHoliday, holidayType, tentative, lunar, createdBy, createdByName, createdAt, updatedAt.
Legacy audience remains a joined display-compatible string. audiences[] is authoritative for multiple selections. Old scalar audiences normalize to a one-item array without destructive migration.
Dates are YYYY-MM-DD; times are HH:mm or null. All-day events persist null times. Reversed dates/times are rejected.
Updates merge existing JSON to preserve historical flags and extra properties.

References:
- classId → classes.
- sectionId → sections, validated against classId.
- teacherId → staff.
- studentId → students, validated against selected class/section.
- noticeId / notice_id → existing school_communications.
- createdBy → users for new/updated records; old unknown identities are not invented.
IDs remain internal; details resolve names or show Unavailable record, never raw IDs.

Migration 29 adds calendar_files:
id text PK; school_id text FK schools; event_id text; name text; type text; size integer; content text; archived boolean; created_at timestamptz; composite FK(school_id,event_id) → school_calendar_events.
Real attachment support: up to five files, 10 MB each, existing shared file validation and database storage, authenticated download and ownership checks. Archived event files cannot be downloaded.

New API: GET/POST /api/v1/calendar-workspace; PATCH /api/v1/calendar-workspace/:id; GET /api/v1/calendar-files/:id.
Existing remove/restore/linked-notice endpoints retained. Legacy event update refuses new multi-audience records, preventing accidental replacement through the old form.

## System and verification

Existing calendar records preserved: YES — all 24 stored records retained.
Tentative/lunar holiday behavior preserved: YES — existing preloadedForYear generator unchanged, with existing confirmation warning. Generated dates are not claimed to be officially verified.
Hidden Holidays preserved: YES — collapsed, named holiday list and version-protected restore.
Permissions preserved: YES — existing calendar permissions, related-record school/scope checks and existing notice permissions.
Console/API errors: PASS for focused happy-path tests; expected validation/version errors tested separately.

Build PASS. Focused integration and isolated browser sanity tests PASS: multiple audiences persist, references, time/date validation, attachments, edit/view, holiday styling, filter, Month/Week/Day/Agenda, print, hidden restore and mobile. No full regression. Live health and asset checks PASS; no live authenticated browser mutation tests.
All monitored business record counts unchanged during deployment, including calendar, notices, leave, attendance, timetable, homework, work logs, exams and results.

Verified backup: backups/schoolhub-before-calendar-ui-2026-09-16T02-13-30-478Z.dump
SHA256: 9226906b53d68f9ed4933566914f6be1fc677458f087057a61c89c1802496684
Screenshots: output/calendar-sanity/month.png, drawer.png, mobile.png.

## Deliberately deferred / unchanged

- No drag/drop calendar engine, hourly scheduling engine, or external calendar synchronization.
- Related Exam and Activity Group selectors not added; only supported, validated Class/Section/Staff/Student references exposed.
- No new archive restoration for user-created events; existing preloaded holiday restore retained.
- No automatic attendance changes or recipient notifications from Mark as Holiday.
- Local-mode calendar and original holiday calculations unchanged; this phase upgrades the server-backed workspace.
- No changes to unrelated operational modules or global print/backup/authorization architecture.
