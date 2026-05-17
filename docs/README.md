# unginx

> A friendly UI on top of nginx. Self-hosters manage reverse-proxy and static-file routes through a web admin, never touching `.conf` files.

## Quickstart

```bash
docker compose up -d
```

Open [http://localhost/__unginx](http://localhost/__unginx) and log in with the default credentials (`unginx` / `unginx`). You'll be prompted to change the password on first login.

## Changing the host port

Edit `docker-compose.yml` and change the left side of the `ports` mapping:

```yaml
ports:
  - "8080:80"   # reach the app at http://localhost:8080
```

## Persistent data

All state lives in the `unginx_data` Docker volume (`/data` inside the container):

| Path | Contents |
|------|----------|
| `/data/db/unginx.sqlite` | SQLite database (routes, groups, settings, version history) |
| `/data/active/` | Live nginx config fragments included by nginx |
| `/data/staging/` | Work-in-progress config during a save operation |
| `/data/versions/` | Snapshots of every config version (rollback data) |
| `/data/logs/` | nginx access/error logs and the backend log |
| `/data/sites/` | Suggested mount point for static-file routes |

The container can be deleted and recreated without losing data as long as the volume is preserved.

## Mounting static-file folders

To serve a folder via the UI's **File Routes** feature, mount it under `/data/sites/`:

```yaml
volumes:
  - unginx_data:/data
  - /path/on/host/my-site:/data/sites/my-site:ro
```

Then in the UI, create a File Route with folder path `/data/sites/my-site`.

---

## Recovery commands

The `unginx` binary inside the container gives you out-of-band access to the database and config system. Every command that mutates state acquires the `/data/staging.lock` file, so it is safe to run while the app is live.

### Print the admin path and username

```bash
docker exec unginx unginx whoami
```

Output example:

```
Admin path   : /__unginx
Admin user   : admin
Schema       : v1
nginx        : nginx version: nginx/1.27.3
```

Use this first if you have forgotten where the admin UI is located.

### Reset a forgotten password

**Interactive** (prompts for username and new password with masked input):

```bash
docker exec -it unginx unginx reset-password
```

**Non-interactive** (for scripting or CI):

```bash
docker exec unginx unginx reset-password --user admin --password 'new-secure-password'
```

- Passwords must be at least 8 characters.
- The command updates the argon2id hash in the database immediately.
- `must_change_password` is cleared, so the UI will not force a change on next login.
- No nginx reload is needed — this is a pure database operation.

### Reset the admin path

If you changed the admin path in Settings and can no longer reach the UI:

```bash
docker exec unginx unginx reset-admin-path
```

This resets `admin_path` to `/__unginx` in the database, re-renders the nginx config, and reloads nginx — all in one step. The UI will be reachable at `http://<host>/__unginx` immediately after.

### Export all config as JSON

```bash
docker exec unginx unginx export > backup.json
```

The JSON file contains all groups, routes, and file routes. It is the same format accepted by the Settings → Data → Export/Import UI and by the `import` command below. Use this regularly to keep an off-container backup.

### Restore config from a JSON export

**Merge** (default — adds entries, skips duplicates by ID):

```bash
docker exec -i unginx unginx import < backup.json
```

**Replace** (deletes all existing routes/groups first, then imports):

```bash
docker exec -i unginx unginx import --replace < backup.json
```

After a successful import the nginx config is regenerated and nginx is reloaded automatically. The operation is atomic: if nginx rejects the new config, the database is rolled back and the previous config remains active.

> **Tip:** Use `import --replace` to restore a complete backup. Use `import` (merge) to copy routes from one instance to another without overwriting existing entries.

---

## Environment variables

| Variable           | Default    | Purpose |
|--------------------|------------|---------|
| `APP_PORT`         | `80`       | Port nginx listens on inside the container. Change the `ports:` mapping in `docker-compose.yml` to expose a different host port without touching this. |
| `UNGINX_USERNAME`  | `unginx`   | First-boot admin username. Ignored on subsequent starts. |
| `UNGINX_PASSWORD`  | `unginx`   | First-boot admin password. Ignored on subsequent starts. If both env vars are absent, the UI forces a password change on first login. |
| `TZ`               | `UTC`      | Timezone for log timestamps and the History page. Standard IANA name (e.g. `Europe/London`). |

---

## Troubleshooting

### The UI is unreachable

1. Check that the container is running: `docker ps | grep unginx`
2. Check the logs: `docker logs unginx --tail 50`
3. Confirm the admin path: `docker exec unginx unginx whoami`
4. Try `http://<host>/<admin-path>` where `<admin-path>` is the value from step 3.
5. If the admin path is wrong or forgotten, run `docker exec unginx unginx reset-admin-path`.

### nginx is down after a save

If you see the nginx status indicator turn red in the UI, unginx has already auto-reverted to the last known-good config. Check the backend logs for the nginx error output:

```bash
docker logs unginx --tail 100 | grep -i nginx
```

You can also run a manual config test from **Settings → Nginx → Test config**.

### Disk is full

If `/data` runs out of space, new saves will fail. Free up space by:

1. Checking how many version snapshots exist: `docker exec unginx sh -c 'ls /data/versions | wc -l'`
2. Removing older snapshots manually (keep the most recent ones).
3. Truncating logs from **Settings → Logs → Truncate** in the UI.

### Recovering from a broken database

If the SQLite database is corrupted, the backend will fail to start. To recover:

```bash
# Stop the container
docker stop unginx

# Enter a temporary container with the data volume mounted
docker run --rm -it -v unginx_data:/data alpine sh

# Attempt an integrity check
# (requires sqlite3 — install with: apk add sqlite)
apk add sqlite
sqlite3 /data/db/unginx.sqlite "PRAGMA integrity_check;"

exit

docker start unginx
```

If you have a JSON export from before the corruption, restore it after the container starts:

```bash
docker exec -i unginx unginx import --replace < backup.json
```

---

## Building the image

```bash
./scripts/build-image.sh
```

This runs `docker build -t unginx:v1 .` from the project root.

## Development

```bash
./scripts/dev.sh
```

Starts the backend and frontend in watch mode. The frontend proxies API calls to the backend via Vite's `server.proxy`. Open `http://localhost:5173` for the hot-reload dev UI.
