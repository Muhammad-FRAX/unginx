#!/usr/bin/env bash
# Build the unginx Docker image.
# Usage: ./scripts/build-image.sh [tag]
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-unginx:v1}"

echo "▶ Building Docker image: ${TAG}"
docker build \
  --file "${ROOT}/docker/Dockerfile" \
  --tag  "${TAG}" \
  "${ROOT}"

echo ""
echo "✓ Image built: ${TAG}"
echo ""
echo "Run with:"
echo "  docker compose up -d"
echo "  # or"
echo "  docker run --name unginx -p 80:80 -v unginx_data:/data ${TAG}"
