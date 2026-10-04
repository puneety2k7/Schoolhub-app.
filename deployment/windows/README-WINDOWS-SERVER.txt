SCHOOLHUB WINDOWS INSTALLATION ? PHASE 11

The previous interactive multi-file/IIS installer has been superseded by the unified root configuration workflow. Use schoolhub.config.env plus Setup-SchoolHub.bat.

This local-PC installer binds only to loopback. Public or multi-machine production hosting still requires a reviewed HTTPS reverse proxy, trusted certificates, restricted firewall rules, managed secrets, and the guidance in schoolhub-server/VMWARE_CLOUD_DEPLOYMENT.md. Do not expose PostgreSQL, port 4010, or the static server directly to the internet.

See schoolhub-server/PHASE11_UNIFIED_CONFIGURATION.md.
