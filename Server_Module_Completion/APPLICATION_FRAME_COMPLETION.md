# Fixed application frame — completion

Top Application Bar: PASS
School Logo: PASS
Brand Name Area Empty: YES
Global Search: PASS — existing input and event handlers retained; no search business logic changed.
Academic Year Control: PASS — existing year and connection indicators retained, including mobile.
Fixed Bottom Bar: PASS
Main Workspace Owns Scroll: YES
Body/Page Scroll Removed: YES — while signed in; login retains its existing layout.
Sidebar Internal Scroll: PASS
Right Drawer Internal Scroll: PASS
Admin Settings: PASS
Tables: PASS
Mobile: PASS
Print Unaffected: YES
Business Logic Unchanged: YES
Console Errors: PASS — zero errors in the focused browser run.

## Layout

- Main vertical scroll owner: `#app > main.content`.
- Grid frame: top row, `minmax(0,1fr)` middle row, footer row. Middle columns are sidebar + workspace. The app fills `100dvh` (with `100vh` fallback).
- Desktop top bar: **72px**.
- Desktop footer: **28px**.
- Mobile (700px and below): **100px** two-row top bar, **22px** compact footer. Search has its own row; Academic Year and connection status remain visible. Existing mobile navigation remains off-canvas; Add/Edit drawers occupy full width.
- Sidebar menu owns its own scroll through `#mainNav`; Settings navigation retains its separate scroll.
- Existing standard drawers are bounded between the frame bars, with fixed header/footer and scrollable body. Existing record drawers and modal bounds also respect the frame.
- Print media hides top bar, sidebar and footer and releases fixed-height/overflow constraints. No print-engine or document-content code changed.

## Branding and controls

The existing `#brandLogo` element was moved into the top bar; the existing School Profile/branding function continues supplying it. No new logo setting or duplicated control was created. A neutral school icon appears when no usable logo exists. The adjacent brand-name area is empty.

The existing global search input, Academic Year, server status, Print and profile controls were moved, not recreated. Existing search semantics remain unchanged (this phase does not add server-wide search). No notification system or fake footer links were added.

## Files

- `SchoolHub_School_Management_App_Complete.html`: loads the layout-only assets.
- `Server_Module_Completion/application-frame.css`: frame, responsive, drawer and print rules.
- `Server_Module_Completion/application-frame.js`: reparents existing controls and synchronizes frame/logo presentation.
- `schoolhub-server/tests/frame-browser.ts`: isolated focused browser sanity test.
- Screenshots: `output/frame-sanity/`.

## Verification and delivery

Focused browser checks passed: Dashboard, configured-logo source and fallback, empty brand area, search input/year presence, long Students table, independent workspace/sidebar scroll, Settings scrolling, right drawer scroll without workspace jump, light/dark themes, mobile navigation/drawer and print-frame exclusion.

No full regression was run. No database migration, stored-data update, workspace-field change, Picklist Manager change, permission change or API restart was needed. New CSS and JS are served successfully by the running app (HTTP 200, CSS served as text/css).

Refresh with Ctrl+F5 to load the updated frame.

