#!/bin/sh
# /usr/local/bin/unginx — thin wrapper that delegates to the compiled Node CLI
exec node /app/backend/dist/cli.js "$@"
