#!/usr/bin/env bash
set -euo pipefail

# Plesk Git "Additional deployment actions" script.
# Runs from repository root.

APP_DIR="web"

if [ ! -d "$APP_DIR" ]; then
  echo "Missing $APP_DIR directory in deployed repo."
  exit 1
fi

# Plesk deployment hooks may run with a restricted PATH.
# Try common Node installation paths before failing.
export PATH="/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:/usr/local/bin:/usr/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.nvm/nvm.sh"
    nvm use --lts >/dev/null 2>&1 || true
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found in PATH. Current PATH: $PATH"
  echo "Install Node.js in Plesk and ensure npm is available to deployment scripts."
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
