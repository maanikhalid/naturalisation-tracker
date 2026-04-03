#!/bin/sh
# Plesk Git hook — POSIX sh.
# Subscription users (not root) often cannot run /usr/bin/npm; use Plesk's Node under /opt/plesk/node only.
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

run_with_plesk_node() {
  _nd=$1
  _node="$_nd/bin/node"
  _npm_sh="$_nd/bin/npm"
  _cli="$_nd/lib/node_modules/npm/bin/npm-cli.js"

  if [ ! -f "$_node" ]; then
    return 1
  fi
  if ! "$_node" --version >/dev/null 2>&1; then
    return 1
  fi

  export PATH="$_nd/bin:$PATH"

  # Prefer npm wrapper in same prefix (Plesk layout).
  if [ -f "$_npm_sh" ] && "$_npm_sh" --version >/dev/null 2>&1; then
    "$_npm_sh" --prefix "$WEB" ci --include=dev --no-audit --no-fund
    "$_npm_sh" --prefix "$WEB" run deploy:plesk
    return 0
  fi

  # Official tarball layout: node + npm-cli.js
  if [ -f "$_cli" ]; then
    "$_node" "$_cli" --prefix "$WEB" ci --include=dev --no-audit --no-fund
    "$_node" "$_cli" --prefix "$WEB" run deploy:plesk
    return 0
  fi

  return 1
}

# 1) Plesk-bundled Node only (works for vhost users; /usr/bin/npm often does not).
for nd in /opt/plesk/node/25 /opt/plesk/node/24 /opt/plesk/node/22 /opt/plesk/node/20; do
  if [ -d "$nd" ] && run_with_plesk_node "$nd"; then
    exit 0
  fi
done

# 2) System npm (often not usable for vhost users on Plesk)
NPM=$(command -v npm 2>/dev/null || true)
if [ -z "$NPM" ]; then
  for candidate in /usr/bin/npm /usr/local/bin/npm; do
    if [ -f "$candidate" ]; then
      NPM=$candidate
      break
    fi
  done
fi

if [ -n "$NPM" ]; then
  NPMDIR=${NPM%/*}
  export PATH="$NPMDIR:$PATH"
  if "$NPM" --version >/dev/null 2>&1; then
    "$NPM" --prefix "$WEB" ci --include=dev --no-audit --no-fund
    "$NPM" --prefix "$WEB" run deploy:plesk
    exit 0
  fi
fi

# 3) Debian system npm-cli + node
for nb in /usr/bin/node /opt/plesk/node/25/bin/node /opt/plesk/node/24/bin/node; do
  if [ -f "$nb" ] && "$nb" --version >/dev/null 2>&1; then
    for cli in \
      /usr/lib/node_modules/npm/bin/npm-cli.js \
      /usr/share/nodejs/npm/bin/npm-cli.js \
      /usr/local/lib/node_modules/npm/bin/npm-cli.js
    do
      if [ -f "$cli" ]; then
        export PATH="${nb%/*}:$PATH"
        "$nb" "$cli" --prefix "$WEB" ci --include=dev --no-audit --no-fund
        "$nb" "$cli" --prefix "$WEB" run deploy:plesk
        exit 0
      fi
    done
  fi
done

echo "npm/node not found for this user. id=$(id 2>/dev/null)" >&2
ls -la /opt/plesk/node/25/bin 2>&1 || true
ls -la /usr/bin/npm /usr/bin/node 2>&1 || true
exit 1
