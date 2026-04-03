#!/bin/sh
# Plesk "Additional deployment actions" — POSIX sh.
# Prefer system npm (/usr/bin/npm): Plesk-bundled node dirs can exist but misbehave in hooks.
set -e

export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:/opt/plesk/node/22/bin:/opt/plesk/node/21/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:/opt/plesk/node/16/bin:${PATH}"

# Repo root = parent of this script
case "$0" in
  */*) _dir=${0%/*} ;;
  *) _dir=. ;;
esac
REPO_ROOT=$(cd "$_dir/.." && pwd)
WEB="$REPO_ROOT/web"

export CI=1
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
export PLESK_SKIP_TYPESCRIPT=1

NPM=""
# System npm first (matches `command -v npm` on a normal shell).
for candidate in \
  /usr/bin/npm \
  /usr/local/bin/npm \
  /opt/plesk/node/25/bin/npm \
  /opt/plesk/node/24/bin/npm \
  /opt/plesk/node/22/bin/npm \
  /opt/plesk/node/21/bin/npm \
  /opt/plesk/node/20/bin/npm \
  /opt/plesk/node/18/bin/npm \
  /opt/plesk/node/16/bin/npm
do
  if [ -x "$candidate" ]; then
    NPM=$candidate
    break
  fi
done

if [ -z "$NPM" ]; then
  NPM=$(command -v npm 2>/dev/null || true)
fi

if [ -z "$NPM" ] && [ -x /usr/bin/find ]; then
  found=$(/usr/bin/find /opt/plesk -maxdepth 6 \( -path '*/bin/npm' -o -path '*/npm' \) -type f 2>/dev/null | /usr/bin/head -n 1)
  if [ -n "$found" ] && [ -x "$found" ]; then
    NPM=$found
  fi
fi

if [ -z "$NPM" ] || [ ! -x "$NPM" ]; then
  echo "npm not found. On SSH run: ls /opt/plesk/node && command -v npm" >&2
  exit 1
fi

# npm runs node/npx; put this npm's bin dir first.
NPMDIR=${NPM%/*}
export PATH="$NPMDIR:$PATH"

"$NPM" --prefix "$WEB" ci --include=dev --no-audit --no-fund
"$NPM" --prefix "$WEB" run deploy:plesk
