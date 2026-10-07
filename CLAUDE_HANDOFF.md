# Claude handoff: current SchoolHub application

Prepared 4 October 2026 from the local working application, not the older single-file School repository. Destination: https://github.com/puneety2k7/Schoolhub-app. (the repository name ends with a period).

## Mandatory change policy

Do not remove, disable, replace, or add functionality without explicit user approval. Fix only requested issues. Preserve existing features, workflows, data structures, and behavior. Read schoolhub-server/AGENTS.md before backend changes. Do not change authorization policy, delete school data, reset a database, or run production migrations merely to investigate a problem.

## What is here

- SchoolHub_School_Management_App_Complete.html: main browser application, including inline JavaScript and styling.
- Server_Module_Completion/: active shared browser modules and styles; required at runtime.
- Phase_WM2_14B/assets/: Workspace Manager and operational custom-field modules; required at runtime.
- schoolhub-server/src/server.ts: backend entry point.
- schoolhub-server/src/routes/, services/, repositories/: API handlers, business logic, and persistence.
- schoolhub-server/src/authorization/: central server authorization registry and policy engine.
- schoolhub-server/src/database/: migrations and database setup logic.
- schoolhub-server/src/factories/: workspace/action definitions.
- schoolhub-server/package.json and package-lock.json: pinned dependency installation and build/test commands.
- schoolhub-sw.js, schoolhub.webmanifest, schoolhub-runtime-config.json: PWA assets and public runtime configuration.
- deployment/windows/: existing setup/start/stop/status/validation scripts and restricted Python static server.
- SOFTWARE_COMPLETE_HANDOFF.md: detailed module inventory. It is an earlier audit from the same day, not proof that all tests pass or every described feature is complete.

The root configuration file schoolhub.config.env, server .env, installed dependencies, compiled output, logs, database backups, and historical backups are intentionally not included. Templates are included. Existing school records are not transferred by cloning this repository.

## Run on Windows (existing supported launcher)

Install Git, Node.js 22 or newer (including npm), Python 3, and PostgreSQL 15 or newer. The launcher needs node, npm.cmd, python, psql, pg_dump, and pg_restore. Ensure PostgreSQL is running. Python must resolve to a working installation rather than a Store placeholder.

Clone into a new directory, not over a running installation:

```powershell
git clone https://github.com/puneety2k7/Schoolhub-app..git Schoolhub-app
cd Schoolhub-app
Copy-Item schoolhub.config.env.example schoolhub.config.env
notepad schoolhub.config.env
```

Use the actual database host, port, database, username, and password in the private configuration. Replace POSTGRES_PASSWORD=CHANGE_ME. The defaults use frontend port 8080, API port 4010, and PostgreSQL port 5432. Keep local development bound to 127.0.0.1. The launcher generates the public runtime JSON and maps configuration to backend environment variables; do not maintain a competing server .env file.

For a NEW empty installation only, provision a dedicated database and owner. For example, run psql as the PostgreSQL administrator and issue the following, choosing a new private password interactively:

```sql
CREATE ROLE schoolhub_app LOGIN;
\password schoolhub_app
CREATE DATABASE schoolhub OWNER schoolhub_app;
```

These are provisioning instructions, not commands to run against an existing school database. For an existing installation use its authorized connection settings and preserve its data.

Then run from the repository root:

```powershell
.\Validate-SchoolHub.bat
.\Setup-SchoolHub.bat
```

Setup checks prerequisites/configuration, installs dependencies with npm ci, builds TypeScript, runs server tests, takes a pre-migration database backup, applies forward-only migrations, and starts the services. It can stop managed services before dependency updates. Do not run it casually against a live school. Resolve failures rather than bypassing tests or resetting data.

Default application URL:
http://127.0.0.1:8080/SchoolHub_School_Management_App_Complete.html

Default backend health URL:
http://127.0.0.1:4010/health

Daily operation after setup:

```powershell
.\Start-SchoolHub.bat
.\Status-SchoolHub.bat
.\Stop-SchoolHub.bat
```

The launchers run the API and Python static server in background processes. The computer and PostgreSQL must remain running. This handoff does not install a Windows service or guarantee automatic startup after reboot.

## First login and data

On a genuinely empty database, use the application's First server setup workflow to create the initial school/admin. No administrator is created by installation and no default password is supplied. Follow the existing mode controls for server login and Server Production activation. Do not silently change Local / Server Pilot / Server Production modes or permission rollout settings.

Cloning source code does not copy the current PostgreSQL database, browser-local records, or private settings. Access existing records through the existing authorized server, or perform a separately approved backup/restore into a new database. Never publish database backups or credentials to this public repository.

## Grid tabs experiment

The implementation is isolated on branch `feature/grid-tabs-experimental`, based on `refactor/universal-governance`. After this branch is merged and deployed, Grid tabs default to OFF for every school whose settings do not explicitly enable them. The established Main/native screens remain active.

Only the exact System Administrator recovery principal can see and change **Admin Settings → Experimental Features → Enable Grid tabs**. Saving reloads the browser so all workspace modules use one consistent state. The setting is stored per school in `schools.settings.experimentalFeatures`, uses optimistic version checks, and writes the `EXPERIMENTAL_FEATURES_UPDATED` audit event.

When disabled, the frontend does not mount universal Grid tabs, custom Grid workspaces, Grid dashboards, or universal Grid actions. The server filters workspace metadata to Main and rejects direct Grid record operations with `EXPERIMENTAL_FEATURE_DISABLED`. Existing workspace configuration, permissions, and Grid records remain stored and become available again after re-enabling the switch. Disabling the experiment is therefore the rollback; do not delete Grid records or restore an older database.

Before merging, resolve any overlap from ongoing Claude work in the modified files, then run the build and full tests shown below.

## Development and verification

For code validation that does not start or migrate the live app:

```powershell
cd schoolhub-server
npm.cmd ci
npm.cmd run build
npm.cmd test
```

Run these in a development checkout. Tests use the project's test setup; inspect a test before connecting it to any external database. Real PostgreSQL tests require a disposable test database. Do not run seed:authorization-qa against production.

For backend watch mode on Windows, load the existing launcher configuration into the current PowerShell process, then run the watcher (stop a development API already using the same port first):

```powershell
# Run from the repository root after creating private configuration.
. .\deployment\windows\SchoolHub.Common.ps1
$schoolhubDevRoot = (Get-Location).Path
$schoolhubDevConfig = Read-SchoolHubConfig (Join-Path $schoolhubDevRoot 'schoolhub.config.env')
Set-SchoolHubEnvironment $schoolhubDevConfig $schoolhubDevRoot
Set-Location schoolhub-server
npm.cmd run dev
```

Frontend files are served from the application root by the supplied Python server. Keep the module folders in their relative locations. Use the HTTP app URL, not a double-clicked file:// page. Check browser console/network errors after changes; account for the existing PWA/service-worker cache without deleting browser school data.

Some older README references point to historical phase documents/test packs that are not present in the current source tree. Confirm a referenced path exists before executing it. The package.json scripts and current launcher source are the operational reference. Do not invent missing files or assume documentation means a check was run.

## Hosting and GitHub

GitHub stores code; uploading does not host the full application. GitHub Pages cannot run this Node.js API or PostgreSQL. Running online requires a suitable host for the backend, PostgreSQL, frontend assets, HTTPS, environment configuration, and backups. See schoolhub-server/VMWARE_CLOUD_DEPLOYMENT.md for existing deployment guidance. The localhost runtime URL must be configured appropriately for a remote deployment.

This repository upload does not configure hosting or auto-deployment and does not move or interrupt the user's current running application. Changes pushed by Claude will only reach a running installation through its separately configured deployment/update process. Obtain explicit approval for a new hosting arrangement or changes to production behavior.

## Handoff validation status

The upload copy was checked for matches to local configured credentials and common token/private-key patterns. Configuration secrets and live database contents were excluded. Application source was copied without intentional code changes. Fresh-install, build, test, browser, and deployment success have not been claimed by this packaging operation; run the appropriate checks in an isolated development environment before changing production.
