# syntax=docker/dockerfile:1
# unginx — multi-stage Dockerfile
#
# Stage 1 (builder): compiles backend + frontend on node:20-alpine
# Stage 2 (final):   nginx:alpine + Node 20 runtime + s6-overlay v3

# ──────────────────────────────────────────────────────────────────────
# Stage 1 — Builder
# ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml ./
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

# Prune backend node_modules to production-only deps
RUN pnpm --filter @unginx/backend --prod deploy /build/backend-prod

# ──────────────────────────────────────────────────────────────────────
# Stage 2 — Final image
# ──────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS final

ARG S6_OVERLAY_VERSION=3.2.0.2
ARG TARGETARCH

# Install Node.js 20, libcap (for setcap), curl (health checks)
RUN apk add --no-cache nodejs libcap curl

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

# Create the unginx user (UID/GID 1000)
RUN addgroup -g 1000 unginx \
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
 && chown -R unginx:unginx /etc/nginx/conf.d

# Copy built backend artifacts
COPY --from=builder /build/apps/backend/dist       /app/backend/dist
COPY --from=builder /build/backend-prod/node_modules /app/backend/node_modules

# Copy built frontend (served by the backend, not nginx directly)
COPY --from=builder /build/apps/web/dist           /app/web/dist

# Copy nginx template
COPY docker/nginx/00-unginx.conf.template /etc/nginx/conf.d/00-unginx.conf.template

# Remove default nginx config (we manage conf.d ourselves)
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy s6 service definitions
COPY docker/s6/nginx          /etc/s6-overlay/s6-rc.d/nginx
COPY docker/s6/unginx-backend /etc/s6-overlay/s6-rc.d/unginx-backend
COPY docker/s6/user/contents.d /etc/s6-overlay/s6-rc.d/user/contents.d

# Make s6 run scripts executable
RUN chmod +x \
      /etc/s6-overlay/s6-rc.d/nginx/run \
      /etc/s6-overlay/s6-rc.d/nginx/finish \
      /etc/s6-overlay/s6-rc.d/unginx-backend/run \
      /etc/s6-overlay/s6-rc.d/unginx-backend/finish

# Install the `unginx` recovery CLI wrapper
COPY docker/unginx-cli.sh /usr/local/bin/unginx
RUN chmod +x /usr/local/bin/unginx

# Copy and configure the entrypoint
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

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
