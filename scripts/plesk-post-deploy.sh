#!/usr/bin/env bash
# Run with: bash scripts/plesk-post-deploy.sh (from repo root).
# Do not run with plain `sh` — bash is required for `pipefail` and predictable behaviour.
set -euo pipefail

# Plesk hooks often ship a minimal PATH; ensure coreutils + Plesk Node are visible.
export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:${PATH}"

# Plesk Git "Additional deployment actions" script — runs from repository root.

APP_DIR="web"

echo "Deploy hook started. pwd=$PWD"
echo "PATH=$PATH"
command -v npm || true
command -v node || true

if [[ ! -d "$APP_DIR" ]]; then
  echo "Missing $APP_DIR directory in deployed repo."
  exit 1
fi

cd "$APP_DIR"

echo "Installing dependencies..."
npm ci --include=dev

echo "Generating Prisma client..."
npm run prisma:generate

echo "Applying Prisma schema to database..."
npm run prisma:push

echo "Building Next.js app..."
npm run build

echo "Deployment actions complete."
