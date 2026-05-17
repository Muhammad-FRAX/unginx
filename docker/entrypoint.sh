#!/bin/sh
# Container entrypoint — runs before s6-overlay launches services.
# Substitutes APP_PORT and ADMIN_PATH into the nginx config template,
# then hands control to s6-overlay's /init.
set -e

APP_PORT="${APP_PORT:-80}"
ADMIN_PATH="${ADMIN_PATH:-/__unginx}"

# Render the nginx config template into /etc/nginx/http.d so it's loaded
# inside the http {} block (alpine includes http.d/*.conf there, not conf.d).
sed \
  -e "s|\${APP_PORT}|${APP_PORT}|g" \
  -e "s|\${ADMIN_PATH}|${ADMIN_PATH}|g" \
  /etc/nginx/http.d/00-unginx.conf.template \
  > /etc/nginx/http.d/00-unginx.conf

# Ensure /data subdirectories exist (volume may have been freshly mounted)
mkdir -p \
  /data/db \
  /data/active \
  /data/staging \
  /data/versions \
  /data/logs \
  /data/sites

# Seed empty nginx fragment files so nginx can start before the backend writes them
[ -f /data/active/routes.conf ] || printf '# empty\n' > /data/active/routes.conf
[ -f /data/active/files.conf  ] || printf '# empty\n' > /data/active/files.conf

# Fix ownership (in case the volume was created by root)
chown -R unginx:unginx /data /run/unginx 2>/dev/null || true

exec /init "$@"
