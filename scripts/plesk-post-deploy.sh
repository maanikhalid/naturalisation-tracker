#!/usr/bin/env bash
# Run with: bash scripts/plesk-post-deploy.sh (from repo root).
# Do not run with plain `sh` — bash is required for `pipefail` and predictable behaviour.
set -euo pipefail

# Plesk hooks often ship a minimal PATH; ensure coreutils + Plesk Node are visible.
export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:/opt/plesk/node/22/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:${PATH}"

# Vhost deploy users often cannot execute /usr/bin/npm; Plesk-bundled npm under /opt/plesk/node usually works.
NPM=""
for c in \
  /opt/plesk/node/25/bin/npm \
  /opt/plesk/node/24/bin/npm \
  /opt/plesk/node/22/bin/npm \
  /opt/plesk/node/20/bin/npm \
  /usr/bin/npm \
  /usr/local/bin/npm
do
  if [[ -f "$c" ]] && "$c" --version >/dev/null 2>&1; then
    NPM=$c
    break
  fi
done
if [[ -z "${NPM}" ]]; then
  NPM=$(command -v npm 2>/dev/null || true)
fi
if [[ -z "${NPM}" ]]; then
  echo "npm not found (hook user cannot run system npm). id=$(id 2>/dev/null) PATH=${PATH}" >&2
  exit 1
fi
export PATH="${NPM%/*}:${PATH}"
echo "Using npm: ${NPM} ($("${NPM}" --version))"

# Plesk Git "Additional deployment actions" script — runs from repository root.

APP_DIR="web"

echo "Deploy hook started. pwd=${PWD}"
command -v node || true

if [[ ! -d "${APP_DIR}" ]]; then
  echo "Missing ${APP_DIR} directory in deployed repo."
  exit 1
fi

cd "${APP_DIR}"

echo "Installing dependencies..."
"${NPM}" ci --include=dev

echo "Generating Prisma client..."
"${NPM}" run prisma:generate

echo "Applying Prisma schema to database..."
"${NPM}" run prisma:push

echo "Building Next.js app..."
"${NPM}" run build

echo "Deployment actions complete."
