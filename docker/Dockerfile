# unginx — multi-stage Dockerfile
#
# Stage 1 (builder): compiles backend + frontend on node:20-alpine
# Stage 2 (final):   node:20-alpine + nginx (apk) + s6-overlay v3
#                    (Node version is pinned to match the builder so native
#                     modules like better-sqlite3 / argon2 keep ABI parity.)

# ──────────────────────────────────────────────────────────────────────
# Stage 1 — Builder
# ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /build

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json    ./apps/backend/
COPY apps/web/package.json        ./apps/web/

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.base.json           ./
COPY packages/shared              ./packages/shared
COPY apps/backend                 ./apps/backend
COPY apps/web                     ./apps/web

# Build shared types/schemas first (backend + web depend on them)
RUN pnpm --filter @unginx/shared build

# Build backend (TypeScript → dist/)
RUN pnpm --filter @unginx/backend build

# Build frontend (Vite → dist/)
RUN pnpm --filter @unginx/web build

# Prune backend node_modules to production-only deps.
# `--legacy` opts back in to the pre-pnpm-10 deploy behavior (which doesn't
# require workspace packages to be marked as injected). It's officially
# supported in pnpm 10 and produces the same output we relied on before.
RUN pnpm --filter @unginx/backend --prod --legacy deploy /build/backend-prod

# ──────────────────────────────────────────────────────────────────────
# Stage 2 — Final image
# ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS final

ARG S6_OVERLAY_VERSION=3.2.0.2
ARG TARGETARCH

# Install nginx, libcap (for setcap), curl (health checks).
# Node.js is already provided by the node:20-alpine base, so we don't add it.
RUN apk add --no-cache nginx libcap curl \
 && mkdir -p /var/log/nginx /etc/nginx/http.d \
 # Patch alpine's default nginx.conf so it works under a non-root master.
 # The defaults point error_log/access_log at /var/log/nginx/{error,access}.log,
 # which are symlinks to /dev/stderr|stdout. Opening those as a non-root user
 # fails because /proc/self/fd/N permission checks reject the re-open.
 # The `stderr` keyword writes to the already-inherited fd 2 instead — no re-open.
 # Per-route access logs (written by routes.conf to /data/logs/access.log) still apply.
 && sed -i \
      -e 's|^error_log /var/log/nginx/error.log warn;|error_log stderr warn;|' \
      -e 's|^\taccess_log /var/log/nginx/access.log main;|\taccess_log off;|' \
      /etc/nginx/nginx.conf

# Install s6-overlay v3 — map Docker's TARGETARCH to s6-overlay's naming convention
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64)  S6_ARCH=x86_64  ;; \
      arm64)  S6_ARCH=aarch64 ;; \
      arm)    S6_ARCH=armhf   ;; \
      386)    S6_ARCH=i686    ;; \
      *)      echo "Unsupported TARGETARCH: ${TARGETARCH}" && exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/s6-overlay-noarch.tar.xz \
      "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz"; \
    curl -fsSLo /tmp/s6-overlay-arch.tar.xz \
      "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz"; \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz; \
    tar -C / -Jxpf /tmp/s6-overlay-arch.tar.xz; \
    rm /tmp/s6-overlay-noarch.tar.xz /tmp/s6-overlay-arch.tar.xz

# Allow nginx to bind privileged ports as a non-root user
RUN setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx \
 && apk del libcap

# Create the unginx user (UID/GID 1000).
# node:20-alpine ships with a pre-created `node` user at UID/GID 1000,
# so remove it first to free the slot.
RUN deluser node 2>/dev/null || true \
 && delgroup node 2>/dev/null || true \
 && addgroup -g 1000 unginx \
 && adduser -u 1000 -G unginx -s /bin/sh -D unginx

# Create persistent and runtime directories
RUN mkdir -p \
      /data/db \
      /data/active \
      /data/staging \
      /data/versions \
      /data/logs \
      /data/sites \
      /run/unginx \
      /app/backend \
      /app/web \
 && chown -R unginx:unginx /data /run/unginx /app \
 && chown -R unginx:unginx /etc/nginx/http.d \
 # Hand nginx's working dirs to unginx so nginx can run as that user too.
 # This lets the backend (also unginx) send SIGHUP to nginx for reloads,
 # and lets nginx write its pid file + temp dirs without root.
 && chown -R unginx:unginx /var/lib/nginx /run/nginx

# Copy built backend artifacts
COPY --from=builder /build/apps/backend/dist       /app/backend/dist
COPY --from=builder /build/backend-prod/node_modules /app/backend/node_modules

# Copy built frontend (served by the backend, not nginx directly)
COPY --from=builder /build/apps/web/dist           /app/web/dist

# Copy nginx template into the http-context snippet directory.
# Alpine's nginx.conf includes /etc/nginx/http.d/*.conf from inside `http {}`,
# which is the correct context for log_format / upstream / server directives.
# (The other dir, /etc/nginx/conf.d, is included at root context — wrong here.)
COPY docker/nginx/00-unginx.conf.template /etc/nginx/http.d/00-unginx.conf.template

# Remove default site config so only our generated 00-unginx.conf is loaded
RUN rm -f /etc/nginx/http.d/default.conf

# Copy s6 service definitions
COPY docker/s6/nginx          /etc/s6-overlay/s6-rc.d/nginx
COPY docker/s6/unginx-backend /etc/s6-overlay/s6-rc.d/unginx-backend
COPY docker/s6/user/contents.d /etc/s6-overlay/s6-rc.d/user/contents.d

# Install the `unginx` recovery CLI wrapper
COPY docker/unginx-cli.sh /usr/local/bin/unginx

# Copy and configure the entrypoint
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Normalize line endings (host may be Windows → CRLF) and make scripts
# executable. The CRLF stripping is what lets the kernel actually parse
# the `#!/bin/sh` shebangs on Linux, and lets s6 read the `type` files
# (a stray `\r` makes "longrun\r" fail s6's validator).
RUN sed -i 's/\r$//' \
      /usr/local/bin/docker-entrypoint.sh \
      /usr/local/bin/unginx \
      /etc/s6-overlay/s6-rc.d/nginx/run \
      /etc/s6-overlay/s6-rc.d/nginx/finish \
      /etc/s6-overlay/s6-rc.d/nginx/type \
      /etc/s6-overlay/s6-rc.d/unginx-backend/run \
      /etc/s6-overlay/s6-rc.d/unginx-backend/finish \
      /etc/s6-overlay/s6-rc.d/unginx-backend/type \
 && chmod +x \
      /usr/local/bin/docker-entrypoint.sh \
      /usr/local/bin/unginx \
      /etc/s6-overlay/s6-rc.d/nginx/run \
      /etc/s6-overlay/s6-rc.d/nginx/finish \
      /etc/s6-overlay/s6-rc.d/unginx-backend/run \
      /etc/s6-overlay/s6-rc.d/unginx-backend/finish

# s6-overlay environment
ENV S6_KEEP_ENV=1
ENV S6_LOGGING=0
# Propagate SIGTERM through s6 to services (5s grace)
ENV S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0
ENV S6_KILL_GRACETIME=5000

# Default environment — can be overridden at runtime
ENV APP_PORT=80
ENV ADMIN_PATH=/__unginx
ENV TZ=UTC

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost/${ADMIN_PATH#/}/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
