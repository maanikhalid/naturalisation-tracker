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

# 2) If the npm script is not runnable (common for vhost UIDs), use node + npm-cli.js from the same prefix.
NODE_BIN=""
NPM_CLI=""
if [[ -z "${NPM}" ]]; then
  for nd in /opt/plesk/node/25 /opt/plesk/node/24 /opt/plesk/node/22 /opt/plesk/node/20; do
    nb="${nd}/bin/node"
    cli="${nd}/lib/node_modules/npm/bin/npm-cli.js"
    if [[ -f "${nb}" && -f "${cli}" ]] && "${nb}" --version >/dev/null 2>&1; then
      NODE_BIN=${nb}
      NPM_CLI=${cli}
      echo "Using npm-cli via node: ${NODE_BIN} ${NPM_CLI}"
      export PATH="${NODE_BIN%/*}:${PATH}"
      break
    fi
  done
fi

# 3) Debian/Ubuntu system layout (node + global npm-cli).
if [[ -z "${NPM}" && -z "${NODE_BIN}" ]]; then
  for nb in /usr/bin/node /usr/local/bin/node; do
    for cli in \
      /usr/lib/node_modules/npm/bin/npm-cli.js \
      /usr/share/nodejs/npm/bin/npm-cli.js \
      /usr/local/lib/node_modules/npm/bin/npm-cli.js
    do
      if [[ -f "${nb}" && -f "${cli}" ]] && "${nb}" --version >/dev/null 2>&1; then
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
    echo "npm not found. id=$(id 2>/dev/null) try on SSH: ls -la /opt/plesk/node/25/bin /opt/plesk/node/25/lib/node_modules/npm/bin" >&2
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
