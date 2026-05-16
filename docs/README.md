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
- SQLite database: `/data/db/unginx.sqlite`
- Active nginx config fragments: `/data/active/`
- Config version history: `/data/versions/`
- nginx and backend logs: `/data/logs/`

The container can be deleted and recreated without losing data, as long as the volume is preserved.

## Mounting static-file folders

To serve a folder via the UI's "File Routes" feature, mount it under `/data/sites/`:

```yaml
volumes:
  - unginx_data:/data
  - /path/on/host/my-site:/data/sites/my-site:ro
```

Then in the UI, create a File Route with folder path `/data/sites/my-site`.

## Recovery commands

```bash
# Reset admin password
docker exec -it unginx unginx reset-password

# Reset admin path back to /__unginx
docker exec unginx unginx reset-admin-path

# Print current admin path
docker exec unginx unginx whoami

# Export all config as JSON
docker exec unginx unginx export > backup.json

# Restore from export
docker exec -i unginx unginx import --replace < backup.json
```

## Environment variables

| Variable           | Default    | Purpose |
|--------------------|------------|---------|
| `APP_PORT`         | `80`       | Port nginx listens on inside the container. |
| `UNGINX_USERNAME`  | `unginx`   | First-boot admin username. |
| `UNGINX_PASSWORD`  | `unginx`   | First-boot admin password. |
| `TZ`               | `UTC`      | Timezone for log timestamps. |

## Building the image

```bash
./scripts/build-image.sh
```
