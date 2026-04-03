#!/usr/bin/env bash
set -euo pipefail

# Plesk Git "Additional deployment actions" script.
# Runs from repository root.

APP_DIR="web"
STEP_TIMEOUT="20m"

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

# Force non-interactive behavior in Plesk hooks.
export CI=true
export npm_config_yes=true
export npm_config_audit=false
export npm_config_fund=false
exec </dev/null

# Keep output flowing in Plesk logs.
run_step() {
  local label="$1"
  shift
  echo "==> $label"
  if command -v timeout >/dev/null 2>&1; then
    timeout "$STEP_TIMEOUT" stdbuf -oL -eL "$@"
  else
    stdbuf -oL -eL "$@"
  fi
}

echo "Installing dependencies..."
run_step "npm ci" npm ci --include=dev --no-audit --no-fund

echo "Generating Prisma client..."
run_step "prisma generate" npm run prisma:generate

echo "Applying Prisma schema to database..."
run_step "prisma push" npm run prisma:push

echo "Building Next.js app..."
run_step "next build" npm run build

echo "Deployment actions complete."
exit 0
