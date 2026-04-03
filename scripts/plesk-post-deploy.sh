#!/usr/bin/env bash
set -euo pipefail

# Plesk Git "Additional deployment actions" script.
# Must not assume cwd: Plesk may run this from httpdocs or elsewhere.

# Hooks sometimes get a PATH with only Node/npm — no coreutils (dirname, tee, date).
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"
export PATH="/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:$PATH"

LOG_FILE="/tmp/naturalisation-tracker-deploy.log"
LOCK_FILE="/tmp/naturalisation-tracker-deploy.lock"
APP_DIR="web"
STEP_TIMEOUT="45m"

# Always log first — if this file never appears, the hook is not running this script.
{
  echo "=== $(date -Is) plesk-post-deploy start ==="
  echo "initial PWD=$PWD"
  echo "BASH_SOURCE=${BASH_SOURCE[0]:-}"
} >>"$LOG_FILE" 2>&1

# Prevent overlapping deploys (duplicate npm ci / half-written .next).
if command -v flock >/dev/null 2>&1; then
  exec 200>"$LOCK_FILE"
  if ! flock -n 200; then
    echo "Another deploy is already running (lock: $LOCK_FILE). Exiting." >>"$LOG_FILE" 2>&1
    exit 0
  fi
fi

# Resolve script directory without `dirname` (some Plesk hooks lack coreutils in PATH).
_script="${BASH_SOURCE[0]}"
if [[ "$_script" == */* ]]; then
  SCRIPT_DIR="$(cd "${_script%/*}" && pwd)"
else
  SCRIPT_DIR="$(pwd)"
fi
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
{
  echo "REPO_ROOT=$REPO_ROOT"
  echo "after cd PWD=$PWD"
} >>"$LOG_FILE" 2>&1

if [ ! -d "$APP_DIR" ]; then
  echo "Missing $APP_DIR under $REPO_ROOT (wrong repo layout or cwd)." >>"$LOG_FILE" 2>&1
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.nvm/nvm.sh"
    nvm use --lts >/dev/null 2>&1 || true
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found in PATH. Current PATH: $PATH" >>"$LOG_FILE" 2>&1
  echo "Install Node.js in Plesk and ensure npm is available to deployment scripts." >>"$LOG_FILE" 2>&1
  exit 1
fi

# Mirror stdout/stderr to log (append after bootstrap lines above).
if command -v tee >/dev/null 2>&1; then
  exec > >(tee -a "$LOG_FILE") 2>&1
else
  exec >>"$LOG_FILE" 2>&1
fi

echo "Deployment log: $LOG_FILE"
echo "Started at: $(date -Is)"

cd "$APP_DIR"

export CI=true
export NEXT_TELEMETRY_DISABLED=1
# Reduce OOM / thrashing during `next build` on small VPS / shared hosting.
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
# See web/next.config.ts — avoids hangs at "Running TypeScript ..." in Plesk.
export PLESK_SKIP_TYPESCRIPT=1
export npm_config_yes=true
export npm_config_audit=false
export npm_config_fund=false
exec </dev/null

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

heartbeat() {
  while true; do
    echo "[heartbeat] deploy still running at $(date -Is)"
    sleep 30
  done
}

heartbeat &
HEARTBEAT_PID=$!
trap 'kill "$HEARTBEAT_PID" >/dev/null 2>&1 || true' EXIT

echo "Installing dependencies..."
run_step "npm ci" npm ci --include=dev --no-audit --no-fund

echo "Generating Prisma client..."
run_step "prisma generate" npm run prisma:generate

echo "Applying Prisma schema to database..."
run_step "prisma push" npm run prisma:push

echo "Building Next.js app..."
run_step "next build" npm run build

echo "Deployment actions complete."
echo "Finished at: $(date -Is)"
exit 0
