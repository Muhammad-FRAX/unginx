#!/usr/bin/env bash
# Start all services for local development (without Docker).
# Requires: pnpm, Node 20, nginx (optional — only for full local testing)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ Building shared package..."
pnpm --filter @unginx/shared build

echo "▶ Starting backend (TCP at localhost:3001 for Vite proxy)..."
DEV_PORT=3001 \
  pnpm --filter @unginx/backend dev &

echo "▶ Starting frontend dev server..."
pnpm --filter @unginx/web dev &

echo ""
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop."

wait
