# unginx — App Plan (v1)

> A friendly UI on top of nginx. Self-hosters add reverse-proxy and static-file routes through a web admin, never touching `.conf` files. Ships as a single Docker container that exposes one port (default **80**, configurable via the `APP_PORT` env var); nginx is the only listener; the admin UI is reserved at `/__unginx`; everything else is user-defined routes.

---

## Table of Contents

1. [Vision & Audience](#1-vision--audience)
2. [Goals & Non-Goals for v1](#2-goals--non-goals-for-v1)
3. [Architecture Overview](#3-architecture-overview)
4. [Request Flow](#4-request-flow)
5. [Tech Stack](#5-tech-stack)
6. [Theme & Design System](#6-theme--design-system)
7. [Container & Process Model](#7-container--process-model)
   - [7.5 Environment Variables](#75-environment-variables)
   - [7.6 Default `docker-compose.yml`](#76-default-docker-composeyml)
8. [Filesystem Layout (Inside Container)](#8-filesystem-layout-inside-container)
9. [Host vs Container Awareness](#9-host-vs-container-awareness)
10. [Domain Model (SQLite Schema)](#10-domain-model-sqlite-schema)
11. [Save → Validate → Reload Pipeline](#11-save--validate--reload-pipeline)
12. [Authentication & First Boot](#12-authentication--first-boot)
13. [CLI Subcommands (Recovery)](#13-cli-subcommands-recovery)
14. [Health Checks](#14-health-checks)
15. [Logs & Log Tagging](#15-logs--log-tagging)
16. [Realtime Updates (SSE)](#16-realtime-updates-sse)
17. [UI Pages](#17-ui-pages)
18. [Validation Rules](#18-validation-rules)
19. [HTTP API Surface](#19-http-api-surface)
20. [Generated nginx Config — Shape](#20-generated-nginx-config--shape)
21. [Repo Layout](#21-repo-layout)
22. [Testing Strategy](#22-testing-strategy)
23. [Non-Functional Requirements](#23-non-functional-requirements)
24. [Build Sequence (Step-by-Step)](#24-build-sequence-step-by-step)
25. [Existing Assets](#25-existing-assets)

---

## 1. Vision & Audience

**Pitch.** Stop hand-editing nginx configs. unginx is a small admin UI that turns common nginx tasks — reverse-proxy a path to a port, serve a folder over a path — into form fields. Save, and the change is live in under a second, with rollback if anything goes wrong.

**Audience.** Self-hosters, small dev teams, internal-tool maintainers. One admin per deployment. No multi-tenancy.

**Brand.** Name: `unginx`. Logo: `unginx-logo.png` (already in repo). Favicon: `favicon.svg` + `favicon.ico` (already in repo). Color identity: black-and-blue (dark mode) / white-and-blue (light mode).

---

## 2. Goals & Non-Goals for v1

### Goals

- Manage HTTP reverse-proxy routes without editing config files.
- Manage static-file serving the same way (folder → URL path).
- Never let a bad config take down the running proxy.
- Be deployable in under five minutes by someone who knows Docker basics.
- Idle footprint under 100MB RAM; cold start to UI reachable under 10s.

### Non-Goals (explicit, v1 only)

- TLS / HTTPS at the front door, Let's Encrypt, custom certs.
- Multiple admin users or roles.
- Virtual hosts / multi-domain routing.
- File upload through the UI (admins mount host folders instead).
- Importing existing `.conf` files.
- TCP / UDP / gRPC proxying — HTTP only.
- Plugin system, alerting, Prometheus metrics export.

These belong to v2 conversations.

---

## 3. Architecture Overview

Single Docker container. One TCP port (default `APP_PORT=80`) exposed. Inside the container:

```
                   ┌──────────────────────────────────────────┐
                   │                Container                 │
client ──── 80 ───▶│  nginx ─┬─▶ user route #1 (TCP)  ────────┼──▶ upstream:4000
                   │         ├─▶ user route #2 (file root)    │
                   │         └─▶ /__unginx ──▶ unix socket ──▶ unginx-backend
                   │                                          │   (Node 20)
                   │                                          │     │
                   │                                          │     ├─▶ SQLite (/data/db)
                   │                                          │     ├─▶ writes nginx conf
                   │                                          │     └─▶ SIGHUP nginx
                   └──────────────────────────────────────────┘
```

- **nginx** is the only TCP listener.
- **unginx-backend** listens on a unix socket at `/run/unginx/backend.sock` — never on a TCP port.
- A reserved top-level location (default `/__unginx`, configurable) forwards admin traffic to that socket. Everything else is generated from the user's routes table.
- The backend is what writes nginx config files and signals reload. nginx remains the workhorse.

---

## 4. Request Flow

In all examples below the port is omitted (default 80). If `APP_PORT` is set to something else, append `:<port>` to the URLs.

### Person 1 — admin opens the UI

```
GET http://host/__unginx
  → nginx matches /__unginx
  → proxy_pass to unix:/run/unginx/backend.sock
  → backend serves index.html / API
```

### Person 2 — user hits a route the admin created (`/one` → `localhost:4000`)

```
GET http://host/one/foo
  → nginx matches location /one (longest prefix wins)
  → proxy_pass http://localhost:4000 (with /foo path if strip-prefix=ON)
  → upstream response → back through nginx
```

### Person 3 — admin saves a new route in the UI

```
POST http://host/__unginx/api/routes
  → nginx → backend (via socket)
  → backend:
       1. INSERT INTO routes ... (in transaction)
       2. Render fragment files to /data/staging/
       3. nginx -t -c /data/staging/nginx.conf
       4. If OK: snapshot current → /data/versions/vNNNN/, swap staging in, SIGHUP, verify
       5. If bad: rollback transaction, return friendly error
  → UI shows success or error
```

Pure path-based dispatch. `http://host` and `http://host/` are identical at the HTTP level — the browser always sends `GET /`.

---

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React 18 + Vite + TypeScript (strict) | Locked by the style guide. |
| UI component lib | Ant Design 5 | Per style guide. |
| Utility CSS | Tailwind 4 (CSS-var bridge) | Per style guide. |
| Data fetching | TanStack Query 5 | Per style guide. |
| Charts | ECharts via `echarts-for-react` | Per style guide. |
| Backend runtime | Node.js 20 LTS | User decision. |
| Backend framework | Fastify | Tiny, fast, first-class JSON schema, SSE-friendly. |
| Backend language | TypeScript (strict) | Shared types with frontend via `packages/shared`. |
| Validation | zod | Single source of truth, shared with frontend. |
| Database | SQLite via `better-sqlite3` | Single-file, zero ops, synchronous API fits the save pipeline. |
| Auth | JWT (HS256) via `jose`, HttpOnly cookie | User decision. |
| Realtime | Server-Sent Events (no extra library) | One-way push fits logs + health perfectly. |
| Process init | s6-overlay v3 | Supervises nginx + backend; signal forwarding; restart-on-crash. |
| Base image | `node:20-alpine` + `nginx:alpine` (multi-stage) | ~50MB final image. |

---

## 6. Theme & Design System

The complete style contract is in `frontend-megastyle.md` (already in repo). The full token system, type scale, spacing, shadows, motion, component patterns, and page recipes are followed verbatim. This section only documents the **palette swap** that makes unginx black-and-blue / white-and-blue, plus where the assets live.

### 6.1 Palette swap

```ts
// apps/web/src/theme/tokens.ts
export const lightTokens = {
  canvas:        '#F4F6FA',
  shell:         '#EEF2F7',
  section:       '#FFFFFF',
  divider:       '#E2E8F0',
  surface:       '#FFFFFF',
  elevated:      '#F9FAFC',
  hover:         '#EFF4FF',
  borderSubtle:  '#CBD5E1',
  borderStrong:  '#94A3B8',
  textPrimary:   '#0B1220',
  textSecondary: '#1F2937',
  textMuted:     '#64748B',
  textInverse:   '#FFFFFF',
  accentPrimary:        '#1E40AF', // blue-800 — deep, "enterprise" blue
  accentPrimarySoft:    '#E0EAFF',
  accentSecondary:      '#14B8A6', // teal-500
  accentSecondarySoft:  '#E6FAF6',
  statusSuccess: '#16A34A',
  statusWarning: '#F97316',
  statusDanger:  '#DC2626',
  statusInfo:    '#0EA5E9',
}

export const darkTokens = {
  canvas:        '#0B0F1A', // near-black with a blue undertone
  shell:         '#111827',
  section:       '#1F2937',
  divider:       '#27324A',
  surface:       '#1A2233',
  elevated:      '#222C42',
  hover:         '#2A3550',
  borderSubtle:  '#334155',
  borderStrong:  '#475569',
  textPrimary:   '#F5F7FA',
  textSecondary: '#CBD5E1',
  textMuted:     '#94A3B8',
  textInverse:   '#0B0F1A',
  accentPrimary:        '#3B82F6', // blue-500 — brightens for dark bg
  accentPrimarySoft:    '#0F2447',
  accentSecondary:      '#2DD4BF',
  accentSecondarySoft:  '#0F2A29',
  statusSuccess: '#22C55E',
  statusWarning: '#FB923C',
  statusDanger:  '#F87171',
  statusInfo:    '#38BDF8',
}
```

### 6.2 Theme default

First boot honors `prefers-color-scheme`. If the user has no preference, default to **dark**. After the first toggle, the choice is remembered in `localStorage` under `unginx.theme`.

### 6.3 Brand assets in the UI

- Sidebar header: `unginx-logo.png` (already at repo root → move to `apps/web/public/unginx-logo.png`).
- Browser tab icon: `favicon.svg` (preferred) + `favicon.ico` (fallback). Move both to `apps/web/public/`.
- Login screen: large centered logo above the username/password form.

See section [25. Existing Assets](#25-existing-assets) for the final destination of each file.

---

## 7. Container & Process Model

- **Image base:** Alpine. Multi-stage build:
  1. `node:20-alpine` builds the frontend (`vite build`) and compiles the backend (`tsc`).
  2. Final stage layered from `nginx:alpine`, adds Node 20 runtime, copies built artifacts, copies s6 service definitions.
- **PID 1:** `s6-overlay-suexec` (s6-overlay v3 init).
- **Services supervised by s6:**
  - `nginx` — `nginx -g 'daemon off;'`
  - `unginx-backend` — `node /app/backend/dist/main.js`
  - `log-rotator` — periodic in-process rotation (also covered by the backend, see §15)
- **User:** dedicated non-root user `unginx` (UID 1000, GID 1000). Owns `/data`, `/run/unginx`, `/etc/nginx/conf.d/`, `/data/staging`, `/data/versions`. Because the default `APP_PORT` is 80 (privileged) and we run as non-root, the Dockerfile grants the nginx binary the `CAP_NET_BIND_SERVICE` capability: `setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx`. This lets a non-root user bind privileged ports without giving the process root.
- **Signals:** `SIGTERM` → s6 → graceful stop of backend (drains any in-flight save) → nginx `quit`.
- **Restart policy:** s6 auto-restarts a crashed backend or nginx with backoff. If nginx fails its post-reload health check, the backend reverts to the previous version automatically.

### Image layers (target)

| Layer | Size budget |
|---|---|
| Alpine base + nginx + node | ~40MB |
| Backend bundle + node_modules (prod) | ~10MB |
| Built frontend (gz) | ~1–2MB |
| s6-overlay | ~1MB |
| **Total final image** | **~50–55MB** |

### 7.5 Environment Variables

All env vars are optional; safe defaults apply. They are read once on container start (the backend caches them in `Setting` rows on first boot — changing an env var later only affects something that hasn't been seeded yet, with the exception of `APP_PORT`, which is re-read on every start).

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `80` | The port nginx listens on **inside** the container. nginx's default port is 80, which is why this is the default. When running **on a plain host** (not in a container), edit `APP_PORT` to whatever port you want the app to bind. When running **in Docker**, leave `APP_PORT=80` and use the `ports:` mapping in `docker-compose.yml` to publish the container's port 80 to any host port you want (`"80:80"`, `"8080:80"`, `"3000:80"`, etc.). |
| `UNGINX_USERNAME` | `unginx` | First-boot admin username. Ignored after the first boot — change the username from Settings instead. |
| `UNGINX_PASSWORD` | `unginx` | First-boot admin password. Ignored after the first boot. If both `UNGINX_USERNAME` and `UNGINX_PASSWORD` are left unset, the seeded user is flagged `must_change_password = 1` and the UI forces a password change at first login (see §12.1). |
| `TZ` | `UTC` | Timezone for log timestamps and the History page. Standard IANA name, e.g. `Europe/London`. |

The backend re-reads `APP_PORT` on every start because it's used to template `/etc/nginx/conf.d/00-unginx.conf` (the `listen ${APP_PORT}` line). Changing it then restarting the container is enough — no manual reload required.

### 7.6 Default `docker-compose.yml`

The repo ships this file at the project root. It's what most users will copy-paste to start. The image name (`unginx:v1`), container name (`unginx`), and volume name (`unginx_data`) are fixed for clarity in `docker ps` / `docker volume ls` output.

```yaml
# docker-compose.yml — project root
#
# Quickstart:
#   docker compose up -d
#   # then open http://localhost
#   # default credentials: unginx / unginx  (you'll be forced to change them on first login)
#
# To change the host port (e.g. 80 is busy on your machine), edit the "ports" line below.
# To change the in-container port, edit APP_PORT in the "environment" block AND the
# right-hand side of the "ports" mapping so they match.

services:
  unginx:
    image: unginx:v1
    container_name: unginx
    restart: unless-stopped
    ports:
      # "HOST:CONTAINER" — left side is what you reach from the outside,
      # right side must equal APP_PORT below.
      - "80:80"
    environment:
      # The port nginx listens on inside the container. Default 80.
      # If you change this, also update the right-hand side of the ports mapping above.
      APP_PORT: "80"
      # First-boot admin credentials. Optional — if omitted, defaults to unginx/unginx
      # and the UI forces a password change on first login.
      # UNGINX_USERNAME: "admin"
      # UNGINX_PASSWORD: "change-me"
      # Timezone for logs and history timestamps.
      TZ: "UTC"
    volumes:
      # Named volume — persists routes DB, version history, nginx logs.
      # Survives `docker compose down` and image upgrades.
      - unginx_data:/data
      # Optional: mount host folders here to serve them via File Routes in the UI.
      # - /path/on/host/my-site:/data/sites/my-site:ro

volumes:
  unginx_data:
    name: unginx_data
```

**Notes on customization:**

- **Different host port:** change `"80:80"` to e.g. `"8080:80"`. The right-hand side (`80`) must stay equal to `APP_PORT`.
- **Different container port:** change both `APP_PORT` and the right-hand side of the port mapping to the new value. Example: `APP_PORT: "8080"` and `"8080:8080"`. Useful when you don't want the container to bind a privileged port internally.
- **Running on a plain host (no Docker):** the binary reads the same `APP_PORT` env var. `APP_PORT=3000 ./unginx` makes nginx listen on `3000`.
- **Volume location:** by default Docker stores `unginx_data` under `/var/lib/docker/volumes/unginx_data/_data`. You can swap the named volume for a bind mount (`./data:/data`) if you prefer the data sitting in the project folder.

---

## 8. Filesystem Layout (Inside Container)

### Read-only (in image)

```
/app
  /backend/dist            compiled JS
  /backend/node_modules    prod deps only
  /web/dist                built React app (served by backend, NOT nginx)
/etc/nginx
  nginx.conf               main; includes /etc/nginx/conf.d/*.conf and /data/active/*.conf
  conf.d/00-unginx.conf    the /__unginx admin location + base server block
/usr/local/bin/unginx      CLI entrypoint (reset-password, reset-admin-path)
```

### Persistent (mounted volume `/data`)

```
/data
  /db
    unginx.sqlite          main DB
    unginx.sqlite-wal      WAL
    unginx.sqlite-shm
  /active                  the live nginx fragments included by nginx.conf
    routes.conf
    files.conf
  /staging                 next config under construction
    nginx.conf             test-only copy referencing staging fragments
    routes.conf
    files.conf
  /versions
    v0001/                 snapshot of /active before version 1
      routes.conf
      files.conf
      db-snapshot.json
    v0002/
    ...
  /logs
    access.log             nginx access log (rotated)
    access.log.1.gz
    error.log              nginx error log
    error.log.1.gz
    backend.log            backend app log mirror (also goes to stdout)
  /sites                   suggested mount point for static-file routes
                           (admin runs e.g. `-v /home/me/site:/data/sites/blog`)
  staging.lock             flock-protected file; one save at a time
```

### Runtime sockets / pids

```
/run/unginx/backend.sock   unix socket nginx proxies admin traffic to
/run/nginx.pid             nginx master pid (used by SIGHUP)
```

---

## 9. Host vs Container Awareness

The backend detects its environment at startup:

- **Container** if any of: `/.dockerenv` exists, OR `/proc/1/cgroup` contains `docker`/`containerd`/`kubepods`, OR `KUBERNETES_SERVICE_HOST` is set.
- Otherwise **host**.

This is surfaced everywhere the difference matters:

- The **route form** shows a warning under "Upstream host" if the user enters `localhost` / `127.0.0.1` while in container mode: *"`localhost` here means inside the container, not your host machine. To reach a service on the host, use `host.docker.internal` (Docker Desktop) or your host's LAN IP."*
- The **file route form** ships a "Browse" modal that lists `/data/sites/*`, plus a banner explaining the `-v /host/path:/data/sites/<name>` pattern.
- The **Settings → Deployment** card shows the detected mode and an override dropdown (rarely needed, but a safety valve).

---

## 10. Domain Model (SQLite Schema)

```sql
-- v0001 schema; future migrations live in /apps/backend/src/db/migrations

CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- seeded keys:
--   admin_path           default '/__unginx'
--   jwt_secret           generated on first boot
--   theme_default        'system' | 'light' | 'dark' (default 'system')
--   schema_version       integer
--   nginx_version        captured on boot for display

CREATE TABLE user (
  id                   INTEGER PRIMARY KEY,
  username             TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,           -- argon2id
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

CREATE TABLE group_ (                            -- "group" is reserved
  id          TEXT PRIMARY KEY,                  -- uuid
  kind        TEXT NOT NULL CHECK (kind IN ('proxy','file')),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  INTEGER NOT NULL,
  UNIQUE (kind, name)
);

CREATE TABLE route (                             -- reverse proxy routes
  id              TEXT PRIMARY KEY,              -- uuid; also used as $unginx_route_id in logs
  group_id        TEXT REFERENCES group_(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  path            TEXT NOT NULL,                 -- must start with /
  upstream_host   TEXT NOT NULL,
  upstream_port   INTEGER NOT NULL CHECK (upstream_port BETWEEN 1 AND 65535),
  upstream_scheme TEXT NOT NULL DEFAULT 'http' CHECK (upstream_scheme IN ('http','https')),
  strip_prefix    INTEGER NOT NULL DEFAULT 1,
  websocket       INTEGER NOT NULL DEFAULT 0,
  enabled         INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  advanced_json   TEXT NOT NULL DEFAULT '{}',    -- see §10.1
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE file_route (                        -- static file routes
  id            TEXT PRIMARY KEY,                -- uuid
  group_id      TEXT REFERENCES group_(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  path          TEXT NOT NULL,                   -- must start with /
  folder_path   TEXT NOT NULL,                   -- absolute filesystem path inside container
  index_files   TEXT NOT NULL DEFAULT 'index.html',  -- comma-separated
  dir_listing   INTEGER NOT NULL DEFAULT 0,
  try_files     TEXT,                            -- e.g. '/index.html' for SPA fallback
  spa_mode      INTEGER NOT NULL DEFAULT 0,      -- preset that sets try_files='/index.html'
  enabled       INTEGER NOT NULL DEFAULT 1,
  description   TEXT,
  advanced_json TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE config_version (
  id               INTEGER PRIMARY KEY,
  version          INTEGER NOT NULL UNIQUE,      -- monotonic, starts at 1
  summary          TEXT NOT NULL,                -- "Created route 'invoices'"
  db_snapshot_json TEXT NOT NULL,                -- full export at this version
  created_at       INTEGER NOT NULL,
  created_by       TEXT                          -- username
);

-- Uniqueness enforced in application code (cannot be a pure SQL UNIQUE because
-- it spans two tables AND filters enabled=1):
--   For all enabled rows across route + file_route, path must be unique.
CREATE INDEX idx_route_enabled_path      ON route(path) WHERE enabled = 1;
CREATE INDEX idx_file_route_enabled_path ON file_route(path) WHERE enabled = 1;
CREATE INDEX idx_route_group             ON route(group_id);
CREATE INDEX idx_file_route_group        ON file_route(group_id);
```

### 10.1 `advanced_json` shape

Same shape for both route and file_route; unused fields are simply absent.

```json
{
  "client_max_body_size_mb": 10,
  "proxy_read_timeout_s":    60,
  "proxy_connect_timeout_s": 5,
  "request_headers":  [{"name": "X-Real-IP",       "value": "$remote_addr"}],
  "response_headers": [{"name": "X-Frame-Options", "value": "DENY"}],
  "rate_limit_req_per_sec": 0
}
```

- All advanced fields are optional. The form's "Advanced" panel is collapsed by default.
- The backend strictly validates this JSON with zod before render.

---

## 11. Save → Validate → Reload Pipeline

The most important guarantee in the product: **the live proxy is never broken by a save**.

```
1. Acquire flock on /data/staging.lock         (queue concurrent saves)
2. BEGIN TRANSACTION on SQLite
3. Apply the mutation (insert/update/delete)
4. Run uniqueness checks (path across enabled routes+files, names within group)
5. Render fresh fragments to /data/staging/{routes.conf, files.conf}
   + write /data/staging/nginx.conf that includes them
6. Run: nginx -t -c /data/staging/nginx.conf
       - On parse/test failure: ROLLBACK, release lock, return friendly error
7. Snapshot current /data/active/ → /data/versions/v{N+1}/ along with db-snapshot.json
8. Atomically swap: rename /data/active → /data/active.old.{ts}, rename /data/staging → /data/active
   - keep the old dir for one cycle, then delete on next successful save
9. Send SIGHUP to nginx master (using /run/nginx.pid)
10. Poll nginx master pid for 1 second: confirm it's still alive and worker count > 0
       - If nginx died or workers vanished: AUTOMATIC REVERT
         - rename /data/active → /data/staging.broken.{ts}
         - rename /data/active.old.{ts} → /data/active
         - SIGHUP nginx again
         - ROLLBACK transaction
         - return error "nginx refused the reload — your previous config is still live"
11. COMMIT transaction
12. INSERT config_version row with db-snapshot + summary
13. Release lock
14. Broadcast SSE event 'config-changed' to all connected UIs
```

### Friendly error mapping

The backend parses nginx's stderr/stdout from `nginx -t` and translates common cases:

| Raw fragment | Friendly message |
|---|---|
| `host not found in upstream` | "Couldn't resolve the upstream host '<name>'. Check the spelling, or use an IP address." |
| `invalid number of arguments in "proxy_pass"` | "The upstream URL is malformed. This is usually a bug in unginx — please file an issue." |
| `duplicate location` | "Two routes have the same path. (Unginx normally prevents this — please file an issue.)" |
| `cannot load certificate` | "Upstream is HTTPS but the server's certificate couldn't be verified." |
| anything else | "nginx rejected the new config." (raw output in expandable "Show technical details") |

---

## 12. Authentication & First Boot

### 12.1 Seeding the first user

1. On startup, if `user` table is empty, insert one row with:
   - `username` = `process.env.UNGINX_USERNAME` or `unginx`
   - `password_hash` = argon2id of `process.env.UNGINX_PASSWORD` or `unginx`
   - `must_change_password` = 1 **if** both env vars were unset (i.e., defaults are in use)
2. If env vars are set but later cleared, the seeded row keeps its existing password — env vars are first-boot only.

### 12.2 Login flow

1. `POST /__unginx/api/auth/login` with `{ username, password }`.
2. Backend verifies with argon2id (constant-time).
3. On success: issue JWT (HS256, 30-day expiry, signed with `Setting.jwt_secret`). Set as `HttpOnly`, `SameSite=Strict`, `Secure` (only if request was HTTPS — local dev tolerates plain HTTP), `Path=<admin_path>` cookie.
4. If `must_change_password=1`, response includes `{ mustChangePassword: true }` — frontend redirects to the change-password screen and **rejects every other API call** until the password is changed.
5. After successful change, `must_change_password` flips to 0, normal flow resumes.

### 12.3 Logout

`POST /__unginx/api/auth/logout` clears the cookie.

### 12.4 Brute-force protection

- 5 failed logins from the same IP in 15 minutes → 30-second lockout. Counter in-memory (fine for single-instance).
- Failed login responses are constant-time and indistinguishable between "no such user" and "wrong password."

---

## 13. CLI Subcommands (Recovery)

Single binary entrypoint `/usr/local/bin/unginx`:

```bash
# Reset admin password (interactive)
docker exec -it <container> unginx reset-password
# Or non-interactive:
docker exec <container> unginx reset-password --user admin --password 'newpw'

# Reset admin path back to default /__unginx
docker exec <container> unginx reset-admin-path

# Print current admin path (useful if forgotten)
docker exec <container> unginx whoami

# Dump current config + db snapshot to stdout (JSON)
docker exec <container> unginx export

# Restore from a JSON export (replace mode)
docker exec -i <container> unginx import --replace < backup.json
```

These commands acquire `/data/staging.lock` just like the API does, so they're safe to run while the app is live.

---

## 14. Health Checks

- A scheduler in the backend runs every 30 seconds.
- For each enabled `route`: attempt a TCP connect to `upstream_host:upstream_port` with a 2-second timeout. Result: `up` / `down` / `unknown` (when scheduler hasn't run yet).
- For each enabled `file_route`: stat the `folder_path`. Result: `up` / `missing`.
- Results cached in memory; pushed to all connected UIs over SSE.
- Failing health checks **never disable a route**. They only color the dot in the routes/files list.

---

## 15. Logs & Log Tagging

### 15.1 Tagging

In every generated `location` block, set the route's UUID as an nginx variable, and emit it in the access log:

```nginx
# In /data/active/routes.conf, top of file:
log_format unginx_combined '$remote_addr - $remote_user [$time_local] '
                           '"$request" $status $body_bytes_sent '
                           '"$http_referer" "$http_user_agent" '
                           'rid=$unginx_route_id rt=$request_time';

# Inside each location block:
location /one {
    set $unginx_route_id "8c3b...uuid...";
    access_log /data/logs/access.log unginx_combined;
    ...
}
```

The backend tails `/data/logs/access.log`, parses `rid=...`, joins to the routes table by UUID, and renders the **friendly route name** in the Logs UI. Requests that didn't hit a user route (404s, the admin UI itself) carry `rid=-`.

### 15.2 Rotation

Backend rotates in-process (a 60-second tick):

- Rotate when `access.log` ≥ 50MB → `access.log.1`, gzip after one rotation cycle.
- Keep the last 10 rotations.
- Also delete any rotation older than 14 days.
- Same policy for `error.log`.
- After rename, send `USR1` to nginx (the standard "reopen logs" signal) so it writes to a fresh file.

### 15.3 Backend's own logs

Go to stdout (so `docker logs` works) **and** mirror to `/data/logs/backend.log` for the Settings → System debug bundle.

---

## 16. Realtime Updates (SSE)

Single endpoint: `GET /__unginx/api/events` (Content-Type `text/event-stream`). One connection per browser tab. Backend multiplexes these event types over it:

| Event | Payload | Triggered by |
|---|---|---|
| `health` | `{ kind: 'route'\|'file_route', id, status }` | every 30s scheduler tick |
| `log` | `{ ts, ip, method, path, status, route_id, route_name, ms, type: 'access'\|'error' }` | each new line tailed from `/data/logs/*` while the Logs page is open |
| `config-changed` | `{ version, summary }` | every successful save / rollback |
| `nginx-status` | `{ running: bool, lastReloadAt }` | s6 readiness probes |
| `ping` | `{}` | every 25s to keep the connection warm |

The Logs page **subscribes to log events** only while open (subscription managed via a query string `?subscribe=log&filter=...`). Other pages stay connected for health / config-changed events.

---

## 17. UI Pages

### 17.1 Shell

- **Sidebar (left, ~220px):** logo (top), nav items (Dashboard, Routes, Files, History, Settings, Logs), collapse toggle. Sidebar items follow style guide §8.
- **Topbar:** page title (from PageHeader), live nginx status indicator (green/red dot + tooltip "Running, last reloaded HH:MM"), username dropdown (Logout).
- **Theme toggle:** in the username dropdown.

### 17.2 Login page

- Centered card on the canvas. `unginx-logo.png` (large), tagline ("nginx, made friendly."), username + password fields, "Sign in" primary button.
- If env vars seeded defaults, show a one-line info banner above the form: "First boot — you'll be asked to set a password after login."
- Errors inline under fields, not as toasts.

### 17.3 Force-password-change page

- Triggered when `mustChangePassword` is true. No sidebar, no escape. Only fields: new password, confirm password. Strong-password meter (zxcvbn). On submit → relogin under the hood → redirect to Dashboard.

### 17.4 Dashboard

Sections (top to bottom, single column on narrow, two columns on wide):

1. **Status card** — nginx running ✓/✗, last reload time, current config version, image version.
2. **Counts row** — KPI cards (style guide §11): total routes (enabled/disabled), total file routes (enabled/disabled), total groups.
3. **Health summary** — small table of routes whose latest health check is `down`, with quick-edit and quick-open-logs links.
4. **Recent activity** — last 5 `config_version` entries.
5. **Quick actions** — buttons: New route, New file route, Open logs.

### 17.5 Routes page

Layout matches a filesystem explorer:

```
┌─ ROUTES                                      [+ New Group]  [+ New Route]
│  📁 finance                          5 routes        [⋮]
│  📁 internal-tools                   3 routes        [⋮]
│  📁 staging                          2 routes        [⋮]
│  ────────────────────────────────────────────────────
│  ● /                  → localhost:3000   [enabled]   [⋮]
│  ● /api               → localhost:4000   [enabled]   [⋮]
│  ○ /old-billing       → 10.0.0.5:8080    [disabled]  [⋮]
```

Groups and ungrouped routes coexist at the same level (filesystem-like). Clicking a group expands it inline (or opens its detail page, depending on viewport). Drag-and-drop or the `[⋮] → Move to group...` action relocates a route.

- **Leftmost dot:** green = upstream up, red = down, gray = disabled.
- **Per-row menu:** Edit, Enable/Disable, Duplicate (adds `-copy` suffix, disabled), Move to group, Delete.
- **Multi-select checkboxes** enable a bulk-action bar: Enable, Disable, Move, Delete.

#### New Route form (drawer, style guide §17)

| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text | yes | Unique within its group (or among ungrouped). |
| Group | dropdown + "Create new" | no | Defaults to Ungrouped. |
| Path | text | yes | Must start with `/`. Auto-prepend if missing. Cannot equal admin_path. |
| Upstream host | text | yes | Container-mode warning on `localhost`. |
| Upstream port | number | yes | 1–65535. |
| Upstream scheme | dropdown | no | `http` (default) / `https`. |
| Strip prefix | toggle | no | Default ON. Tooltip explains. |
| WebSocket support | toggle | no | Default OFF. Adds the `Upgrade`/`Connection` headers. |
| Enabled | toggle | no | Default ON. |
| Description | textarea | no | Free notes. |
| **Advanced** (collapsed) | — | — | — |
| Max request body (MB) | number | no | → `client_max_body_size`. |
| Read timeout (s) | number | no | → `proxy_read_timeout`. |
| Connect timeout (s) | no | — | → `proxy_connect_timeout`. |
| Request headers | key-value list | no | → `proxy_set_header`. |
| Response headers | key-value list | no | → `add_header`. |
| Rate limit (req/s) | number | no | Generates `limit_req_zone` + `limit_req`. 0 = off. |

### 17.6 Files page

Identical structure to Routes (same filesystem-style group layout).

#### New File Route form

| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text | yes | |
| Group | dropdown | no | |
| Path | text | yes | URL path, e.g. `/docs`. |
| Folder path | text + Browse | yes | Filesystem path inside container. Browse modal lists `/data/sites/*`. |
| Index files | text | no | Comma-separated. Default `index.html`. |
| Directory listing | toggle | no | Default OFF. |
| Single-page-app mode | toggle | no | Preset: sets Try-files-fallback to `/index.html`. |
| Try-files fallback | text | no | Hidden when SPA mode is ON (it's just the preset). |
| Enabled | toggle | no | Default ON. |
| Description | textarea | no | |
| **Advanced** | — | — | Same set as Routes where applicable (custom response headers, etc.). |

On save: a non-blocking warning appears if the folder doesn't exist yet ("Folder not found — you can still save; mount it before the route is needed.").

### 17.7 History page

Reverse-chronological list of `config_version` rows.

```
v0042  2026-05-16 14:22  admin  Created route "invoices"           [View] [Rollback]
v0041  2026-05-16 14:18  admin  Updated route "reports"            [View] [Rollback]
v0040  2026-05-16 13:55  admin  Deleted file route "old-marketing" [View] [Rollback]
v0039  2026-05-15 09:10  admin  Renamed group "billing" → "finance"[View]
```

- **View:** diff between this version and the previous one (renders DB snapshot diff as a side-by-side route/file table; no raw nginx config shown unless an "Advanced" toggle is flipped).
- **Rollback:** restores the DB snapshot at that version, runs the save pipeline. The rollback itself is a new version, so it's reversible.
- Group renames create a history row but **do not trigger an nginx reload** (no routes changed).
- Retention: keep the last 100 versions or 30 days, whichever yields more.

### 17.8 Settings page

Sections:

- **Admin account** — change username, change password (both require current password).
- **Admin path** — read-only current value with [Change…] button. Changing regenerates the nginx admin location and the UI redirects to the new path after the reload succeeds.
- **Deployment** — detected mode (Container / Host) with override dropdown. Container metadata: image version, mount points, env vars (env values redacted for keys matching `*PASSWORD*` / `*SECRET*`).
- **Nginx** — version string, [Reload nginx] (manual SIGHUP), [Test config] (runs `nginx -t` on the **active** config and shows output).
- **Data** — Export all routes/groups as JSON, Import from JSON (Merge / Replace modes — Replace requires typing `REPLACE`), Reset to factory (requires typing `RESET`).
- **Theme** — Light / Dark / System (mirrors the topbar toggle).

### 17.9 Logs page

- Tabs: **Access** | **Error**.
- Live tail (newest at top), pause/play toggle ("Live"), filter bar:
  - Route (multi-select from current routes)
  - Status code (multi-select: 2xx, 3xx, 4xx, 5xx, or specific codes)
  - IP (free text)
  - Time range (last 15min / 1h / 6h / 24h / custom)
- Download last N lines as `.log`.
- Truncate / Reset (with confirmation; useful after disk-noise testing).

---

## 18. Validation Rules

Single source of truth: zod schemas in `packages/shared/src/schemas/`.

### Path

- Must start with `/`.
- Cannot equal the current admin_path or any reserved variant (`/__unginx`, `/__unginx/*`).
- Cannot contain `..`, control characters (ASCII < 0x20), whitespace, or `?#`.
- May be `/` (catch-all).
- Length ≤ 256 characters.

### Path uniqueness

- For all rows where `enabled = 1` across `route` + `file_route`, `path` must be unique.
- Returns 409 with: *"A route with path `/api` already exists in group `finance`. Disable or delete it before creating another."*

### Names

- Unique within a group (or within "Ungrouped").
- Length 1–64.
- Allowed: letters, digits, space, `-`, `_`, `.`.

### Upstream host

- Length 1–255.
- Must be an IPv4, IPv6, or DNS hostname (RFC 1123).
- `localhost` triggers a warning (not an error) in container mode.

### Folder path (file routes)

- Must be absolute (start with `/`).
- Cannot include `..`.
- Existence check is a **warning**, never an error.

### Admin path change

- All path rules above, plus:
- Must contain at least one path segment (`/x` minimum).
- Strongly recommend `/__something`; a soft warning if the user picks a "human-looking" prefix like `/admin`.

---

## 19. HTTP API Surface

All endpoints are mounted under `<admin_path>/api/`. All return JSON. All require a valid JWT cookie except `/auth/login` and `/health`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/login` | Exchange username+password for cookie. |
| `POST` | `/auth/logout` | Clear cookie. |
| `POST` | `/auth/change-password` | Required when `must_change_password = 1`, also for routine changes. |
| `GET`  | `/me` | Current user + must_change_password flag. |
| `GET`  | `/health` | Backend liveness (public). |
| `GET`  | `/dashboard` | Aggregated counts + nginx status + recent activity. |
| `GET`  | `/groups?kind=proxy\|file` | List groups. |
| `POST` | `/groups` | Create. |
| `PATCH`| `/groups/:id` | Rename / re-describe. |
| `DELETE`| `/groups/:id?mode=move\|delete` | Move children to Ungrouped or delete them too. |
| `GET`  | `/routes` | List (filter by group, enabled). |
| `POST` | `/routes` | Create. |
| `GET`  | `/routes/:id` | Read. |
| `PATCH`| `/routes/:id` | Update. |
| `POST` | `/routes/:id/duplicate` | Copy with `-copy` suffix, disabled. |
| `POST` | `/routes/:id/enable` / `/disable` | Toggle. |
| `POST` | `/routes/:id/move` | `{ group_id: string\|null }`. |
| `DELETE`| `/routes/:id` | Delete. |
| `POST` | `/routes/bulk` | Bulk enable/disable/move/delete. |
| `GET`  | `/file-routes` ... | Same surface as routes. |
| `GET`  | `/health-status` | Latest cached health for all routes + files. |
| `GET`  | `/versions` | History list. |
| `GET`  | `/versions/:v` | Snapshot + diff against previous. |
| `POST` | `/versions/:v/rollback` | Restore. |
| `GET`  | `/settings` | All settings (admin path, deployment info, nginx version, etc.). |
| `PATCH`| `/settings/admin-path` | `{ newPath }`. |
| `POST` | `/nginx/test` | Run `nginx -t` against active config. |
| `POST` | `/nginx/reload` | Manual SIGHUP. |
| `GET`  | `/data/export` | Streams JSON of all groups/routes/files/settings. |
| `POST` | `/data/import?mode=merge\|replace` | Body = the export JSON. |
| `POST` | `/data/reset` | Body must be `{ confirmation: "RESET" }`. |
| `GET`  | `/logs/download?type=access\|error&lines=N` | Returns text. |
| `POST` | `/logs/truncate?type=access\|error` | Confirmation required. |
| `GET`  | `/events` (SSE) | Realtime stream (see §16). |
| `GET`  | `/files/browse?path=/data/sites` | Lists immediate children for the file-route Browse modal. |

Every mutating endpoint runs through the save pipeline (§11). Even renaming a group goes through the pipeline so it gets a history entry (with `reload: false` shortcut to skip nginx).

---

## 20. Generated nginx Config — Shape

### `00-unginx.conf` (committed in the image)

```nginx
# /etc/nginx/conf.d/00-unginx.conf

upstream unginx_backend {
    server unix:/run/unginx/backend.sock;
}

# log_format is declared in routes.conf (see §15) so it's always re-rendered
# alongside the locations that reference it.

server {
    listen ${APP_PORT} default_server;   # templated at boot from env (default 80)
    server_name _;

    # The admin UI / API
    location /__unginx {                            # path is templated from setting.admin_path
        proxy_pass http://unginx_backend;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE
        proxy_buffering    off;
        proxy_read_timeout 1h;
        # WebSocket (future)
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }

    # User routes + file routes are included from /data/active
    include /data/active/routes.conf;
    include /data/active/files.conf;

    # Fallback when nothing matches
    location / {
        # Only kicks in if there's no enabled route at "/"
        return 404 "No route configured at this path.\n";
    }
}
```

### `/data/active/routes.conf` (regenerated on every save)

```nginx
# AUTO-GENERATED by unginx — do not edit by hand.
# Generated at: 2026-05-16T14:22:08Z, version v0042

log_format unginx_combined '$remote_addr - $remote_user [$time_local] '
                           '"$request" $status $body_bytes_sent '
                           '"$http_referer" "$http_user_agent" '
                           'rid=$unginx_route_id rt=$request_time';

# --- Route: "invoices" (group: finance) ---
location /invoices {
    set $unginx_route_id "8c3b1e9c-1234-...";
    access_log /data/logs/access.log unginx_combined;

    proxy_pass http://127.0.0.1:4001;     # strip-prefix ON adds no trailing slash logic
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # advanced fields rendered here if present
}
# ... more locations ...
```

### `/data/active/files.conf`

```nginx
# AUTO-GENERATED by unginx — do not edit by hand.

location /docs {
    set $unginx_route_id "f0a2-...";
    access_log /data/logs/access.log unginx_combined;

    alias /data/sites/docs/;
    index index.html;
    try_files $uri $uri/ /index.html;          # SPA mode
    autoindex off;
}
```

---

## 21. Repo Layout

```
/
├── apps/
│   ├── web/                         # React frontend
│   │   ├── public/
│   │   │   ├── unginx-logo.png      # moved from repo root
│   │   │   ├── favicon.svg          # moved from repo root
│   │   │   └── favicon.ico          # moved from repo root
│   │   ├── src/
│   │   │   ├── theme/tokens.ts      # the §6 palette
│   │   │   ├── theme/antd.ts        # ConfigProvider algorithm + tokens
│   │   │   ├── theme/echarts.ts     # getEChartsTheme(mode)
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── ForceChangePassword.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Routes.tsx
│   │   │   │   ├── Files.tsx
│   │   │   │   ├── History.tsx
│   │   │   │   ├── Settings.tsx
│   │   │   │   └── Logs.tsx
│   │   │   ├── components/...
│   │   │   ├── api/                 # TanStack Query hooks
│   │   │   ├── sse.ts               # /events client
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── backend/                     # Node + TS service
│       ├── src/
│       │   ├── main.ts              # Fastify boot + s6 readiness file
│       │   ├── cli.ts               # `unginx` subcommands
│       │   ├── db/
│       │   │   ├── client.ts        # better-sqlite3 init + WAL
│       │   │   ├── migrations/
│       │   │   │   └── 0001_init.sql
│       │   │   └── seed.ts
│       │   ├── auth/                # JWT, argon2, cookie middleware
│       │   ├── pipeline/            # the §11 save pipeline
│       │   ├── nginx/
│       │   │   ├── render.ts        # routes/files → nginx config strings
│       │   │   ├── test.ts          # spawn nginx -t
│       │   │   ├── reload.ts        # kill -HUP, verify
│       │   │   └── parse-errors.ts  # friendly messages (§11)
│       │   ├── routes-api/          # Fastify route plugins
│       │   ├── logs/
│       │   │   ├── tail.ts          # follow access.log + error.log
│       │   │   ├── rotate.ts        # 50MB × 10, 14d (§15.2)
│       │   │   └── parse.ts         # regex for log_format
│       │   ├── health/              # 30s scheduler (§14)
│       │   ├── env/                 # container-vs-host detection (§9)
│       │   └── sse/                 # event bus + multiplexer (§16)
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                      # zod schemas, shared types, constants
│       ├── src/
│       │   ├── schemas/
│       │   ├── types.ts
│       │   └── constants.ts
│       └── package.json
│
├── docker/
│   ├── Dockerfile                   # multi-stage (§7)
│   ├── nginx/
│   │   └── 00-unginx.conf.template  # §20 with ${ADMIN_PATH} placeholder
│   └── s6/
│       ├── nginx/
│       │   ├── run                  # exec nginx -g 'daemon off;'
│       │   └── finish
│       ├── unginx-backend/
│       │   ├── run                  # exec node /app/backend/dist/main.js
│       │   └── finish
│       └── log-rotator/             # optional — kept inside backend instead
│
├── scripts/
│   ├── dev.sh                       # docker compose up -d for local dev
│   └── build-image.sh               # docker build -t unginx:v1 .
│
├── docs/
│   └── README.md
│
├── docker-compose.yml               # ships with the repo; see §7.5 for full contents
├── package.json                     # workspaces: apps/*, packages/*
├── pnpm-workspace.yaml              # using pnpm
├── frontend-megastyle.md            # the style contract (already present)
├── unginx-logo.png                  # WILL BE MOVED to apps/web/public/
├── favicon.svg                      # WILL BE MOVED to apps/web/public/
├── favicon.ico                      # WILL BE MOVED to apps/web/public/
└── plan.md                          # this file
```

---

## 22. Testing Strategy

### Backend (Vitest)

- **Renderer golden tests** — small route fixtures → expected nginx config strings. Detects accidental output drift.
- **Pipeline tests** — using a real `nginx` binary in CI: write fixture, run pipeline, assert active dir swaps; intentionally break a rule, assert active is untouched and old version restored.
- **Validators** — exhaustive zod schema tests for path/name/upstream rules + the cross-table uniqueness check.
- **Auth** — argon2 round-trip, JWT issue/verify, brute-force lockout window.
- **CLI** — spawn each subcommand against a temp `/data`, assert behavior.

### Frontend (Vitest + React Testing Library)

- Forms: every validation rule round-trips correctly between zod and the UI.
- Conflict-detection flow (`/` already exists → second `/` shows the friendly error).
- Theme: tokens emit on `<html data-theme="..">` correctly; toggle persists.
- SSE client: reconnects on drop, multiplexes event types.

### End-to-end (Playwright)

- One golden flow: `docker build -t unginx:v1 .` → `docker run --name unginx -p 80:80 -v unginx_data:/data unginx:v1` → login as `unginx/unginx` → set password → create a proxy route to a tiny `nc -l` listener → curl through the public port → assert the listener received the request → rollback → assert removed → `docker rm -f unginx && docker volume rm unginx_data` for cleanup.

### CI

- GitHub Actions matrix: lint → unit → build image → e2e.
- Image size budget check: fail if final image exceeds 70MB.

---

## 23. Non-Functional Requirements

| Metric | Target |
|---|---|
| Idle RAM (no traffic) | < 100MB |
| Idle CPU | < 1% on a single core |
| Cold start (`docker run` → UI reachable) | < 10s |
| Save → reload completion (≤ 50 routes) | < 1s |
| `nginx -t` failure → friendly error in UI | < 500ms |
| Image size | < 70MB |
| Persistent state | All of it lives under `/data` — destroying the container is safe if `/data` is mounted. |
| Graceful shutdown on `SIGTERM` | Backend drains in-flight save (max 5s grace), then exits; nginx `quit`s. |
| App's own logs | Go to stdout (so `docker logs` works) and mirror to `/data/logs/backend.log`. |
| Concurrency | One save at a time across API + CLI, enforced by `/data/staging.lock`. |

---

## 24. Build Sequence (Step-by-Step)

The order below is designed so each step delivers something runnable / verifiable. Don't skip ahead — later steps depend on earlier ones working.

### Phase 0 — Project scaffolding

1. **Init monorepo.** `pnpm init`, set up `pnpm-workspace.yaml` covering `apps/*` and `packages/*`. Add root `tsconfig.base.json` with strict settings.
2. **Create `packages/shared`.** Stub `types.ts`, `constants.ts`, and an empty `schemas/` folder. Export from `index.ts`. No runtime deps.
3. **Create `apps/backend` skeleton.** Fastify + better-sqlite3 + argon2 + jose + zod. `main.ts` that just boots Fastify on a unix socket and answers `GET /api/health` with `{ ok: true }`. Add `tsx` for dev runs.
4. **Create `apps/web` skeleton.** Vite + React 18 + TS + Antd + Tailwind + ECharts + TanStack Query + react-router. `App.tsx` shows "unginx" on a canvas-colored background. Configure Tailwind per style guide §2.5.
5. **Wire the theme.** Implement `theme/tokens.ts`, `theme/antd.ts`, `theme/echarts.ts` exactly as §6. Verify both modes render the canvas/shell/surface ladder correctly using a one-screen demo.

### Phase 1 — Single container that hosts everything (no features yet)

6. **Write `docker/Dockerfile`.** Multi-stage: builder stage compiles backend + frontend; final stage starts from `nginx:alpine`, layers in Node 20 runtime, copies built artifacts, adds the `unginx` user (UID 1000) and `chown`s `/data`, `/run/unginx`, `/etc/nginx/conf.d`.
7. **Add s6-overlay.** Drop in v3, define services `nginx` and `unginx-backend`. Set `S6_KEEP_ENV=1` and signal forwarding flags.
8. **Write `docker/nginx/00-unginx.conf.template`.** Use a small entrypoint script to substitute `${ADMIN_PATH}` (read from DB or env at first boot) into the real `00-unginx.conf` before launching nginx.
9. **Confirm round-trip.** `docker build -t unginx:v1 .`, `docker run --name unginx -p 80:80 -v unginx_data:/data unginx:v1`, hit `http://localhost/__unginx/api/health` → see backend's response served through nginx via the unix socket. This is the keystone milestone for the architecture. (On a host where port 80 is busy, map `-p 8080:80` and hit `http://localhost:8080/__unginx/api/health` instead.)

### Phase 2 — Data layer

10. **DB init + migrations.** Implement `db/client.ts` with WAL mode, busy timeout, foreign keys ON. Write `migrations/0001_init.sql` matching §10. Add a tiny migrator that runs pending migrations on boot.
11. **Seed on first boot.** Insert default `setting` rows; if `user` table empty, seed the admin user from env vars (or defaults with `must_change_password=1`).
12. **JWT + cookie middleware.** Implement login / logout / change-password endpoints with argon2 + jose. Verify `/me` returns the user when cookie is present.

### Phase 3 — Save pipeline (heart of the product)

13. **Renderer.** `nginx/render.ts` — pure function: `(state) → { 'routes.conf': string, 'files.conf': string, 'nginx.conf': string }`. Add Vitest golden tests early.
14. **`nginx -t` runner.** `nginx/test.ts` spawns nginx with the staging config; parses stderr into structured form.
15. **Friendly error mapper.** `nginx/parse-errors.ts` — maps the known emerg/error strings to human messages.
16. **Atomic swap + reload.** `pipeline/save.ts` glues everything in §11 together: flock, transaction, render, test, snapshot, swap, SIGHUP, verify, commit, broadcast. Auto-revert path is non-negotiable — write a test that proves it.
17. **Manual reload + test endpoints.** `/api/nginx/test` and `/api/nginx/reload` for Settings page.

### Phase 4 — CRUD for routes, file-routes, groups

18. **Groups API.** Create / list / rename / delete (with `mode=move|delete`).
19. **Routes API.** Full CRUD + duplicate + enable/disable + bulk. Every mutation goes through the pipeline.
20. **File-routes API.** Mirror of Routes API.
21. **Versions API.** List + view-diff + rollback. Implement retention (100 versions OR 30 days, whichever yields more).
22. **Export / import / reset.** JSON dump + restore in merge/replace modes; factory reset with confirmation phrase.

### Phase 5 — Observability

23. **Log tailing + rotation.** `logs/tail.ts` follows `access.log` and `error.log`; `logs/rotate.ts` enforces 50MB × 10 + 14-day policy and signals nginx `USR1` after rename.
24. **Health scheduler.** `health/index.ts` ticks every 30s, TCP-connects each enabled route, stats each file-route folder, caches results, emits SSE.
25. **SSE bus.** `sse/index.ts` mounts `/api/events`; multiplexes `health`, `log`, `config-changed`, `nginx-status`, `ping`. Frontend client reconnects on drop.

### Phase 6 — Frontend pages

26. **Shell + routing.** Sidebar, topbar, theme toggle, JWT-guarded routes, logout. PageHeader pattern per style guide §9.
27. **Login + force-change-password.** Use the brand logo + Antd Form. Show env-defaults banner when applicable.
28. **Dashboard.** KPI row, status card, health summary, recent activity, quick actions.
29. **Routes page.** Filesystem-style group list (groups + ungrouped at same level), per-row menu, bulk actions, health dot from SSE.
30. **Route drawer (create/edit).** Basic fields + collapsed Advanced section. Inline validation from shared zod schemas. Container-mode warning on `localhost`.
31. **Files page + drawer.** Mirror of Routes with file-route fields, Browse modal listing `/data/sites/*`, SPA-mode preset.
32. **History page.** Reverse-chronological version list, diff viewer, rollback action.
33. **Settings page.** All sections from §17.8. Admin-path change with redirect.
34. **Logs page.** Tabs (access / error), filters, live tail via SSE, pause/play, download, truncate.

### Phase 7 — CLI & recovery

35. **`unginx` CLI.** Implement `reset-password`, `reset-admin-path`, `whoami`, `export`, `import`. Each acquires `staging.lock` and reuses the pipeline.
36. **Document recovery procedures** in `docs/README.md`.

### Phase 8 — Hardening & ship

37. **Brute-force lockout.** 5 fails / 15min / 30s lockout per IP.
38. **Graceful shutdown.** Backend SIGTERM handler drains the save lock (max 5s), then exits 0.
39. **Container size budget.** Image must be < 70MB. CI gate.
40. **Playwright e2e.** The full golden flow described in §22.
41. **`docker-compose.yml`** at repo root — verify it matches §7.5 verbatim (image `unginx:v1`, container `unginx`, volume `unginx_data`, default ports `80:80`, all env vars documented in comments).
42. **README.** Quickstart (one `docker run`), screenshots, recovery commands, troubleshooting, contributing.
43. **Tag v1.0.0** and build/publish the image (target: GHCR or Docker Hub — user's call at ship time).

---

## 25. Existing Assets

These files are already in the repo root and **will be moved** during Phase 0 / Phase 6:

| File (current location) | Destination | Used for |
|---|---|---|
| `unginx-logo.png` | `apps/web/public/unginx-logo.png` | Sidebar header, Login page, Force-change-password page |
| `favicon.svg` | `apps/web/public/favicon.svg` | Browser tab icon (modern) |
| `favicon.ico` | `apps/web/public/favicon.ico` | Browser tab icon (fallback) |
| `frontend-megastyle.md` | stays at repo root | Style contract — referenced by `apps/web` during build but not bundled |

The Vite config will declare `apps/web/public` as the public directory so these files are copied to the build output verbatim. The `index.html` head will reference:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/unginx-logo.png" />
<title>unginx</title>
```

No new logo art needs to be created. The black-and-blue palette in §6 was picked to harmonize with the existing logo.

---

*End of plan.*
