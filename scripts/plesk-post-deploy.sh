#!/bin/sh
# Plesk "Additional deployment actions" — POSIX sh.
set -e

export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:/opt/plesk/node/22/bin:/opt/plesk/node/21/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:/opt/plesk/node/16/bin:${PATH}"

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

NPM=$(command -v npm 2>/dev/null || true)

if [ -z "$NPM" ]; then
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
    if [ -f "$candidate" ] || [ -x "$candidate" ]; then
      NPM=$candidate
      break
    fi
  done
fi

if [ -z "$NPM" ] && [ -x /usr/bin/find ]; then
  found=$(/usr/bin/find /opt/plesk -maxdepth 6 -path '*/bin/npm' -type f 2>/dev/null | /usr/bin/head -n 1)
  if [ -n "$found" ]; then
    NPM=$found
  fi
fi

# Put npm's directory on PATH so the npm script finds node/npx.
if [ -n "$NPM" ]; then
  NPMDIR=${NPM%/*}
  export PATH="$NPMDIR:$PATH"
fi

run_npm() {
  if [ -n "$NPM" ] && "$NPM" --version >/dev/null 2>&1; then
    "$NPM" "$@"
    return 0
  fi
  return 1
}

if run_npm --prefix "$WEB" ci --include=dev --no-audit --no-fund; then
  run_npm --prefix "$WEB" run deploy:plesk
  exit 0
fi

# Fallback: node + npm-cli.js (Debian/Ubuntu layout)
NODE_BIN=""
for nb in /usr/bin/node /opt/plesk/node/25/bin/node /opt/plesk/node/24/bin/node /opt/plesk/node/20/bin/node; do
  if [ -f "$nb" ] || [ -x "$nb" ]; then
    NODE_BIN=$nb
    break
  fi
done

NPM_CLI=""
for cli in \
  /usr/lib/node_modules/npm/bin/npm-cli.js \
  /usr/share/nodejs/npm/bin/npm-cli.js \
  /usr/local/lib/node_modules/npm/bin/npm-cli.js
do
  if [ -n "$NODE_BIN" ] && [ -f "$cli" ]; then
    NPM_CLI=$cli
    break
  fi
done

if [ -z "$NODE_BIN" ] || [ -z "$NPM_CLI" ]; then
  echo "npm not found. id=$(id 2>/dev/null) PATH=$PATH" >&2
  ls -l /usr/bin/npm /usr/bin/node 2>&1 || true
  exit 1
fi

export PATH="${NODE_BIN%/*}:$PATH"
"$NODE_BIN" "$NPM_CLI" --prefix "$WEB" ci --include=dev --no-audit --no-fund
"$NODE_BIN" "$NPM_CLI" --prefix "$WEB" run deploy:plesk
