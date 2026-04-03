#!/bin/sh
# Plesk "Additional deployment actions" — minimal POSIX, no bashisms.
# Requires: /bin/sh, cd, npm (Node on PATH). No dirname/tee/flock.
set -e

export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:${PATH}"

# Repo root = parent of this script (POSIX dirname without dirname(1))
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

npm --prefix "$WEB" ci --include=dev --no-audit --no-fund
npm --prefix "$WEB" run deploy:plesk
