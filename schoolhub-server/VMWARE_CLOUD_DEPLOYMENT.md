# SchoolHub Phase 7 deployment on a VMware cloud VM

This runbook assumes an Ubuntu Server VM and a DNS name such as `school.example.com`. The same architecture works on VMware Cloud, vSphere, ESXi, or another VM provider.

## Recommended layout

For a pilot, one VM can run Nginx, the Node server, and PostgreSQL. For production, use two private-networked VMs or a managed PostgreSQL service:

```text
Internet → HTTPS/443 → Nginx → 127.0.0.1:4010 Node API
                              → static SchoolHub HTML
Node API → private network/TLS → PostgreSQL:5432
```

Expose only ports 80 and 443 on the application VM. Do not expose Node port 4010 publicly. PostgreSQL 5432 must be reachable only from the application VM/private subnet. PostgreSQL `listen_addresses` and `pg_hba.conf` control which network interfaces and clients may connect; use a narrow application-VM CIDR, not `0.0.0.0/0`. See the [PostgreSQL 18 connection documentation](https://www.postgresql.org/docs/18/runtime-config-connection.html).

## 1. Prepare the VM

1. Create an Ubuntu 24.04 LTS VM with a fixed private IP, current security updates, time synchronization, and at least 2 vCPU/4 GB RAM for a pilot.
2. Create DNS `school.example.com` pointing to the public load balancer or application VM.
3. Configure the VMware/network firewall:
   - Internet → app VM: TCP 80/443.
   - App VM → database: TCP 5432 on the private address only.
   - Administration: SSH only from your trusted VPN/admin IP.
4. Install Node.js 22+ LTS, Nginx, and PostgreSQL client tools. Install the PostgreSQL server only on the database VM.
5. Create a non-login service account and directories:

```bash
sudo useradd --system --home /opt/schoolhub --shell /usr/sbin/nologin schoolhub
sudo mkdir -p /opt/schoolhub/server /var/www/schoolhub
sudo chown -R schoolhub:schoolhub /opt/schoolhub
```

## 2. Create PostgreSQL identity

Run as a PostgreSQL administrator on the database host. Replace the placeholder with a strong randomly generated password kept in a secret manager:

```sql
CREATE ROLE schoolhub_app LOGIN PASSWORD 'REPLACE_WITH_RANDOM_SECRET';
CREATE DATABASE schoolhub OWNER schoolhub_app;
REVOKE ALL ON DATABASE schoolhub FROM PUBLIC;
GRANT CONNECT ON DATABASE schoolhub TO schoolhub_app;
```

If the database is on another VM, enable PostgreSQL TLS and use a `hostssl` rule restricted to the app VM address. Never use `trust` authentication in production. PostgreSQL documents SSL server setup and client-certificate options in its [secure TCP/IP guide](https://www.postgresql.org/docs/18/runtime-ssl.html).

## 3. Copy and build SchoolHub

Copy these items to the application VM:

- `SchoolHub_School_Management_App_Complete.html` → `/var/www/schoolhub/index.html`
- `schoolhub-server/` → `/opt/schoolhub/server/`

Then:

```bash
cd /opt/schoolhub/server
sudo -u schoolhub npm ci
sudo -u schoolhub npm run build
sudo -u schoolhub npm test
```

Do not copy the Windows `.postgresql-test` directory, `.env`, dumps, or `node_modules`.

## 4. Configure the server secret file

Create `/opt/schoolhub/server/.env` owned by `schoolhub`, mode `600`:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4010
DATABASE_URL=postgresql://schoolhub_app:URL_ENCODED_PASSWORD@DB_PRIVATE_IP:5432/schoolhub?sslmode=require
SESSION_COOKIE_NAME=schoolhub_sid
SESSION_TTL_MINUTES=480
ALLOWED_ORIGINS=https://school.example.com
TRUST_PROXY=true
LOG_LEVEL=info
```

URL-encode reserved password characters. Prefer injecting `DATABASE_URL` through the VMware/CI secret store rather than keeping it permanently on disk. Use `sslmode=verify-full` and the database CA when your PostgreSQL provider supports full certificate verification.

## 5. Apply migrations

Back up the database before every deployment, then run:

```bash
cd /opt/schoolhub/server
sudo -u schoolhub npm run migrate
sudo -u schoolhub npm run migrate
```

The first run should report migrations 1 and 2; the second should report no applied migrations. Never run the integration test against this database—the test creates 1,000 disposable records. Use an isolated database/schema instead.

## 6. Run Node as a service

Create `/etc/systemd/system/schoolhub.service`:

```ini
[Unit]
Description=SchoolHub Phase 7 API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=schoolhub
Group=schoolhub
WorkingDirectory=/opt/schoolhub/server
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/schoolhub/server

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now schoolhub
sudo systemctl status schoolhub
curl http://127.0.0.1:4010/health
```

The health response contains only status and API version.

## 7. Put Nginx and HTTPS in front

Nginx should serve the HTML and pass API/health requests to Node. Its official reverse-proxy guide explains `proxy_pass` and forwarded headers: [NGINX reverse proxy documentation](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/).

```nginx
server {
    listen 80;
    server_name school.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name school.example.com;

    ssl_certificate     /etc/letsencrypt/live/school.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/school.example.com/privkey.pem;

    root /var/www/schoolhub;
    index index.html;
    client_max_body_size 25m;

    location = /health {
        proxy_pass http://127.0.0.1:4010;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4010;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Issue the TLS certificate with your approved CA/ACME client, test with `sudo nginx -t`, and reload Nginx. Do not activate Server Pilot over plain HTTP because production session cookies are Secure.

## 8. Activate SchoolHub Server Pilot

1. Open `https://school.example.com`.
2. Keep Local mode selected initially and export a verified local backup.
3. In Admin Settings → Server Pilot, enter backend URL `https://school.example.com` and the school server ID.
4. Test the connection.
5. If the server has no school yet, use **First server setup** to create the initial Super Admin. There is no default password.
6. Sign in to the server, run Import Preview, review rejected/local-only counts, then explicitly confirm the atomic import.
7. Activate Server Pilot. Test from a second browser/device.
8. Confirm attendance, timetable, homework, Work Logs, exams/marks, fees, leave, notices, calendar, documents, and reports show the local-only notice.

The frontend backend URL is the public HTTPS origin—not the private PostgreSQL address. Browsers never connect directly to PostgreSQL and must never receive database credentials.

## 9. Verification checklist

- `https://school.example.com/health` returns `{"status":"ok","apiVersion":"v1"}`.
- Browser cookies show `schoolhub_sid` as HttpOnly, Secure, and SameSite=Strict.
- No token exists in localStorage.
- Invalid API access returns a structured denial.
- Linked teachers see only assigned class/section students and no protected contact fields.
- Two-device stale updates return `RECORD_VERSION_CONFLICT`.
- Restart Node and PostgreSQL and verify sessions/data behavior.
- Confirm Local mode still opens existing browser data without merging server records.

## 10. Backup, rotation, and upgrades

- Schedule encrypted `pg_dump --format=custom` backups to storage outside the VM and routinely restore them into an isolated recovery database.
- Snapshotting the VM alone is not a tested database restore strategy.
- Rotate the password that was exposed during local setup, update the secret store, and restart the Node service.
- To invalidate every login after an incident, run `DELETE FROM sessions;` as an authorized maintenance action.
- Before upgrades: export Local mode, take/verify a PostgreSQL backup, run automated tests, apply migrations, test `/health`, then enable traffic.
