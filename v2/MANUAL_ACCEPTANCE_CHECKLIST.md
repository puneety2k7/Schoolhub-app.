# SchoolHub V2 — manual acceptance checklist (foundation only)

You fill in the result column yourself. "Expected" is what you should see; nothing here has been marked as passed.

**Start:** double-click `Setup-SchoolHub-V2.bat` (first time) or `Start-SchoolHub-V2.bat`, then open `http://127.0.0.1:5180` in Chrome.
**Stop:** `Stop-SchoolHub-V2.bat`. **Check:** `Status-SchoolHub-V2.bat`.

| # | What to do | Expected result | Your result |
|---|---|---|---|
| 1 | Click **First server setup**; enter school name, School ID, your name, username, a strong password; click **Create school and sign in** | You are signed in as System Administrator. The left menu shows **Administration → Workspace Manager** and **Users & Access** | |
| 2 | Workspace Manager → new workspace: key `test-workspace`, name `Test Workspace`, plural `Test Workspaces` → **Create workspace** | The workspace opens for editing with four tabs listed: MAIN, GRID_1, GRID_2, GRID_3 | |
| 3 | Open **Test Workspaces** in the menu | Tabs shown: **Dashboard, Main, Grid 1, Grid 2, Grid 3** | |
| 4 | In Workspace Manager add a section "Details" to each tab, then a field to each: MAIN `main_test_field` "Main Test Field"; GRID_1 `grid_1_test_field` "Grid 1 Test Field"; GRID_2 `grid_2_test_field` "Grid 2 Test Field"; GRID_3 `grid_3_test_field` "Grid 3 Test Field" (text) | Each field is listed under its own tab only | |
| 5 | Open each tab in the workspace | Each tab shows only its own field as a column | |
| 6 | Main: **Add** a record; then use **View**, **Edit**, **Print**, **Archive**, **Restore**, then Archive again and **Permanent Delete** | Each action works; Add appears only above the table | |
| 7 | Repeat on Grid 1, Grid 2, Grid 3 | Add creates a record only on that Grid; the other tabs do not change | |
| 8 | Look at row buttons | ACTIVE row: View, Edit, Print, Archive (no Restore, no Permanent Delete). ARCHIVED row: View, Print, Restore, Permanent Delete (no Archive) | |
| 9 | Workspace Manager → Forms: create a form for Grid 2 with its field, assign it to **GRID_2**. In the workspace use Grid 2: Add, View, Edit | The Grid stays visible behind a dialog. Add = blank dialog, View = read-only dialog, Edit = populated dialog | |
| 10 | Workspace Manager → Dashboard components: add a Metric (Main, count) and a Table (Grid 1) | The Dashboard tab shows the metric number and the table rows | |
| 11 | Users & Access: create an ordinary user, a group, and a role for Test Workspace; put the role in the group and the user in the group | They appear in the lists | |
| 12 | Give the role only **GRID_1 VIEW** (no Dashboard VIEW); sign in as that user | Only **Grid 1** is available; no Dashboard tab; Grid 1 opens and works; no Administration menu | |
| 13 | Role: add/remove **GRID_1 ADD** (re-sign in each time) | Without ADD there is no Add button; with it Add works | |
| 14 | Role: add/remove **GRID_1 EDIT** | Without EDIT there is no Edit button | |
| 15 | Role: add/remove **GRID_1 DELETE** | Without DELETE there is no Archive button | |
| 16 | Sign in as the System Administrator again | You see every applicable action on every tab, still obeying the Active/Archived rules | |

Safety: V2 refuses to start unless the database is exactly `schoolhub_v2` (or `schoolhub_v2_test` for tests). It never uses your old SchoolHub database, ports 4010/8080, or old launchers.
