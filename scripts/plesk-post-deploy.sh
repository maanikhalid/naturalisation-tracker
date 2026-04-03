#!/bin/sh
# Plesk may invoke this with `sh`, not bash — no pipefail, no bash-only options.
set -e

# Plesk Git "Additional deployment actions" script.
# Runs from repository root.

APP_DIR="web"

echo "Deploy hook started. pwd=$PWD"
echo "PATH=$PATH"
command -v npm || true
command -v node || true

if [ ! -d "$APP_DIR" ]; then
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
