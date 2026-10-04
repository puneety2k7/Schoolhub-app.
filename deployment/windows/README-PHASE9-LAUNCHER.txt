SCHOOLHUB PHASE 11 UNIFIED WINDOWS LAUNCHER

FIRST USE
1. Copy the root schoolhub.config.env.example to schoolhub.config.env.
2. Edit that one file. Leave ALLOWED_ORIGINS=AUTO for localhost.
3. Double-click the root Setup-SchoolHub.bat.

DAILY USE
Use the root Start-SchoolHub.bat, Status-SchoolHub.bat, and Stop-SchoolHub.bat.
Use Validate-SchoolHub.bat for a read-only configuration and PostgreSQL check.

The launcher binds the frontend and API only to configured loopback hosts, validates exact SchoolHub process command lines before reuse or stop, writes bounded logs under logs, backs up PostgreSQL before migration, and never creates an administrator automatically.

See schoolhub-server/PHASE11_UNIFIED_CONFIGURATION.md for full installation, security, recovery, and troubleshooting instructions.
