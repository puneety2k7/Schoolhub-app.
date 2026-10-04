# SchoolHub project structure

The project root now contains only the active application, server, configuration, and deployment launchers.

## Runtime and setup

- `SchoolHub_School_Management_App_Complete.html` — browser application.
- `schoolhub-sw.js`, `schoolhub.webmanifest`, `schoolhub-runtime-config.json` — PWA/runtime files.
- `schoolhub.config.env` and `.example` — launcher configuration.
- `schoolhub-server/` — PostgreSQL server source, compiled runtime, dependencies, package manifests, database migrations, and deployment documentation.
- `Server_Module_Completion/` and `Phase_WM2_14B/` — active shared browser modules loaded by the application; these are runtime dependencies, not historical backups.
- `deployment/` and `SchoolHub_Production_Launcher/` — installation and launch assets.
- `Setup/Start/Stop/Status/Validate-SchoolHub.bat` — operator shortcuts.

## Trash

`Trash/` contains recoverable backups, tests, generated logs/output, sample data, historical phase bundles, and development-only tools. Nothing was deleted. Runtime database migrations remain under `schoolhub-server/src/database` because they are required to initialize or upgrade PostgreSQL on a new installation.