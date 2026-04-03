#!/usr/bin/env bash
# Run with: bash scripts/plesk-post-deploy.sh (from repo root).
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:/opt/plesk/node/22/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:${PATH}"

# 1) Prefer npm wrapper when the hook user can execute it.
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

NODE_BIN=""
NPM_CLI=""

try_node_cli() {
  local nb=$1
  local cli=$2
  [[ -f "${nb}" && -f "${cli}" ]] || return 1
  # Real check: npm-cli must respond (node --version alone is not enough).
  "${nb}" "${cli}" --version >/dev/null 2>&1
}

# 2) Fixed paths under /opt/plesk/node/*
if [[ -z "${NPM}" ]]; then
  for nd in /opt/plesk/node/25 /opt/plesk/node/24 /opt/plesk/node/22 /opt/plesk/node/20; do
    cli="${nd}/lib/node_modules/npm/bin/npm-cli.js"
    for nb in "${nd}/bin/node" "${nd}/bin/nodejs"; do
      if try_node_cli "${nb}" "${cli}"; then
        NODE_BIN=${nb}
        NPM_CLI=${cli}
        echo "Using npm-cli via node: ${NODE_BIN} ${NPM_CLI}"
        export PATH="${NODE_BIN%/*}:${PATH}"
        break 2
      fi
    done
  done
fi

# 3) Discover layout — Plesk/OS builds differ; walk any npm-cli.js under /opt/plesk/node.
if [[ -z "${NPM}" && -z "${NODE_BIN}" ]] && command -v find >/dev/null 2>&1; then
  while IFS= read -r cli; do
    [[ -z "${cli}" ]] && continue
    nd="${cli%/lib/node_modules/npm/bin/npm-cli.js}"
    [[ "${nd}" == "${cli}" ]] && continue
    for nb in "${nd}/bin/node" "${nd}/bin/nodejs"; do
      if try_node_cli "${nb}" "${cli}"; then
        NODE_BIN=${nb}
        NPM_CLI=${cli}
        echo "Using npm-cli via node (discovered): ${NODE_BIN} ${NPM_CLI}"
        export PATH="${NODE_BIN%/*}:${PATH}"
        break
      fi
    done
  done < <(find /opt/plesk/node -name npm-cli.js -type f 2>/dev/null | head -30)
fi

# 4) Debian/Ubuntu system layout.
if [[ -z "${NPM}" && -z "${NODE_BIN}" ]]; then
  for nb in /usr/bin/node /usr/bin/nodejs /usr/local/bin/node; do
    for cli in \
      /usr/lib/node_modules/npm/bin/npm-cli.js \
      /usr/share/nodejs/npm/bin/npm-cli.js \
      /usr/local/lib/node_modules/npm/bin/npm-cli.js
    do
      if try_node_cli "${nb}" "${cli}"; then
        NODE_BIN=${nb}
        NPM_CLI=${cli}
        echo "Using system npm-cli via node: ${NODE_BIN} ${NPM_CLI}"
        export PATH="${NODE_BIN%/*}:${PATH}"
        break 2
      fi
    done
  done
fi

run_npm() {
  if [[ -n "${NPM}" ]]; then
    "${NPM}" "$@"
  elif [[ -n "${NODE_BIN}" && -n "${NPM_CLI}" ]]; then
    "${NODE_BIN}" "${NPM_CLI}" "$@"
  else
    echo "npm not found. id=$(id 2>/dev/null)" >&2
    echo "--- /opt/plesk/node/*/bin (first dirs) ---" >&2
    ls -la /opt/plesk/node/25/bin 2>&1 || true
    ls -la /opt/plesk/node/24/bin 2>&1 || true
    echo "--- search for npm-cli.js ---" >&2
    find /opt/plesk/node -name npm-cli.js -type f 2>/dev/null | head -20 >&2 || true
    exit 1
  fi
}

if [[ -n "${NPM}" ]]; then
  export PATH="${NPM%/*}:${PATH}"
  echo "Using npm: ${NPM} ($(run_npm --version))"
fi

APP_DIR="web"

echo "Deploy hook started. pwd=${PWD}"
command -v node || true

if [[ ! -d "${APP_DIR}" ]]; then
  echo "Missing ${APP_DIR} directory in deployed repo."
  exit 1
fi

cd "${APP_DIR}"

echo "Installing dependencies..."
run_npm ci --include=dev

echo "Generating Prisma client..."
run_npm run prisma:generate

echo "Applying Prisma schema to database..."
run_npm run prisma:push

echo "Building Next.js app..."
run_npm run build

echo "Deployment actions complete."
