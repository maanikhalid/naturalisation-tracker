#!/usr/bin/env bash
# Run with: bash scripts/plesk-post-deploy.sh (from repo root).
set -euo pipefail

# Always use full paths to coreutils — Plesk hooks sometimes omit /usr/bin from PATH.
LS=/usr/bin/ls
FIND=/usr/bin/find
HEAD=/usr/bin/head

export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:/opt/plesk/node/22/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:${PATH}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Optional override (create on server via SSH if auto-discovery fails):
#   REPO_ROOT/.plesk-node-env.sh  →  export NPM=/path/to/npm
#   or  export NODE_BIN=... NPM_CLI=...
if [[ -f "${REPO_ROOT}/.plesk-node-env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.plesk-node-env.sh"
fi

NPM="${NPM:-}"
NODE_BIN="${NODE_BIN:-}"
NPM_CLI="${NPM_CLI:-}"

try_node_cli() {
  local nb=$1
  local cli=$2
  [[ -f "${nb}" && -f "${cli}" ]] || return 1
  "${nb}" "${cli}" --version >/dev/null 2>&1
}

# Validate optional override file
if [[ -n "${NPM}" ]] && ! "${NPM}" --version >/dev/null 2>&1; then
  echo "Ignoring invalid NPM=${NPM} from .plesk-node-env.sh" >&2
  NPM=""
fi
if [[ -n "${NODE_BIN}" && -n "${NPM_CLI}" ]]; then
  if try_node_cli "${NODE_BIN}" "${NPM_CLI}"; then
    echo "Using npm-cli from .plesk-node-env.sh: ${NODE_BIN} ${NPM_CLI}"
    export PATH="${NODE_BIN%/*}:${PATH}"
  else
    echo "Ignoring invalid NODE_BIN/NPM_CLI from .plesk-node-env.sh" >&2
    NODE_BIN=""
    NPM_CLI=""
  fi
fi

# 1) Prefer npm wrapper when the hook user can execute it.
if [[ -z "${NPM}" ]]; then
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
fi
if [[ -z "${NPM}" ]]; then
  NPM=$(command -v npm 2>/dev/null || true)
fi

# 2) Fixed paths under /opt/plesk/node/* (skip if override already set pair).
if [[ -z "${NPM}" && (-z "${NODE_BIN}" || -z "${NPM_CLI}") ]]; then
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

# 3) Walk /opt/plesk/node for npm-cli.js
if [[ -z "${NPM}" && (-z "${NODE_BIN}" || -z "${NPM_CLI}") ]] && [[ -x "${FIND}" ]]; then
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
        break 2
      fi
    done
  done < <("${FIND}" /opt/plesk/node -name npm-cli.js -type f 2>/dev/null | "${HEAD}" -30)
fi

# 4) Debian/Ubuntu system layout + find under /usr/lib
if [[ -z "${NPM}" && (-z "${NODE_BIN}" || -z "${NPM_CLI}") ]]; then
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

if [[ -z "${NPM}" && (-z "${NODE_BIN}" || -z "${NPM_CLI}") ]] && [[ -x "${FIND}" ]]; then
  while IFS= read -r cli; do
    [[ -z "${cli}" ]] && continue
    for nb in /usr/bin/node /usr/bin/nodejs /usr/local/bin/node; do
      if try_node_cli "${nb}" "${cli}"; then
        NODE_BIN=${nb}
        NPM_CLI=${cli}
        echo "Using system npm-cli (discovered): ${NODE_BIN} ${NPM_CLI}"
        export PATH="${NODE_BIN%/*}:${PATH}"
        break 2
      fi
    done
  done < <("${FIND}" /usr/lib /usr/local/lib -maxdepth 8 -name npm-cli.js -type f 2>/dev/null | "${HEAD}" -20)
fi

run_npm() {
  if [[ -n "${NPM}" ]]; then
    "${NPM}" "$@"
  elif [[ -n "${NODE_BIN}" && -n "${NPM_CLI}" ]]; then
    "${NODE_BIN}" "${NPM_CLI}" "$@"
  else
    echo "npm not found. id=$(id 2>/dev/null)" >&2
    echo "--- ls /opt/plesk (permission?) ---" >&2
    "${LS}" -la /opt 2>&1 || true
    "${LS}" -la /opt/plesk 2>&1 || true
    "${LS}" -la /opt/plesk/node 2>&1 || true
    "${LS}" -la /opt/plesk/node/25/bin 2>&1 || true
    "${LS}" -la /opt/plesk/node/24/bin 2>&1 || true
    echo "--- find npm-cli.js ---" >&2
    "${FIND}" /opt/plesk/node -name npm-cli.js -type f 2>/dev/null | "${HEAD}" -20 >&2 || true
    "${FIND}" /usr/lib /usr/local/lib -maxdepth 8 -name npm-cli.js -type f 2>/dev/null | "${HEAD}" -20 >&2 || true
    echo "--- hint: create ${REPO_ROOT}/.plesk-node-env.sh with NPM= or NODE_BIN= + NPM_CLI= ---" >&2
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
