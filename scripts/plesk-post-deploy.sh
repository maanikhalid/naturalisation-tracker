#!/usr/bin/env bash
# Run with: bash scripts/plesk-post-deploy.sh (from repo root).
#
# Plesk note — chroot: If SSH is disabled for the subscription system user, Git
# hooks often run in a CHROOT whose root is that user's home. Then /usr, /opt,
# and Plesk's Node under /opt/plesk are NOT visible — only paths inside the
# subscription (e.g. $HOME, httpdocs, this repo) exist. Use Node in $HOME (nvm,
# fnm), repo-local tools, or .plesk-node-env.sh; or enable non-chroot SSH /
# run builds outside this hook. See README "Plesk chroot".
set -euo pipefail

# Avoid external `dirname` (may be missing in minimal chroot).
_script="${BASH_SOURCE[0]}"
_sdir=${_script%/*}
[[ "${_script}" == */* ]] || _sdir=.
SCRIPT_DIR="$(cd "${_sdir}" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LS_CMD=$(command -v ls 2>/dev/null || echo /bin/ls)
FIND_CMD=$(command -v find 2>/dev/null || true)
HEAD_CMD=$(command -v head 2>/dev/null || true)

# Optional override (create on server): REPO_ROOT/.plesk-node-env.sh
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

# PATH: chroot-safe first ($HOME), then typical non-chroot locations.
export PATH="${REPO_ROOT}/tools/node/bin:${PATH}"
if [[ -n "${HOME:-}" ]]; then
  export PATH="${HOME}/.local/bin:${HOME}/bin:${PATH}"
  # nvm installs per-version bins here (common workaround when /usr is not visible).
  if [[ -d "${HOME}/.nvm/versions/node" ]]; then
    shopt -s nullglob
    for _nvbin in "${HOME}/.nvm/versions/node"/*/bin; do
      export PATH="${_nvbin}:${PATH}"
    done
    shopt -u nullglob
  fi
fi
export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:/opt/plesk/node/22/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:${PATH}"

# 0) After PATH includes $HOME, npm may resolve (nvm, etc.)
if [[ -z "${NPM}" ]]; then
  NPM=$(command -v npm 2>/dev/null || true)
fi

# 0b) Explicit nvm npm binaries
if [[ -z "${NPM}" && -n "${HOME:-}" && -d "${HOME}/.nvm/versions/node" ]]; then
  shopt -s nullglob
  for _npm in "${HOME}/.nvm/versions/node"/*/bin/npm; do
    if [[ -f "${_npm}" ]] && "${_npm}" --version >/dev/null 2>&1; then
      NPM=${_npm}
      break
    fi
  done
  shopt -u nullglob
fi

# 1) System / Plesk paths (only work when NOT chrooted)
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

# 2) Fixed paths under /opt/plesk/node/*
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

# 3) find under /opt/plesk/node
if [[ -z "${NPM}" && (-z "${NODE_BIN}" || -z "${NPM_CLI}") && -n "${FIND_CMD}" && -x "${FIND_CMD}" ]]; then
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
  done < <("${FIND_CMD}" /opt/plesk/node -name npm-cli.js -type f 2>/dev/null | "${HEAD_CMD:-head}" -30)
fi

# 4) Debian system layout
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

if [[ -z "${NPM}" && (-z "${NODE_BIN}" || -z "${NPM_CLI}") && -n "${FIND_CMD}" && -x "${FIND_CMD}" ]]; then
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
  done < <("${FIND_CMD}" /usr/lib /usr/local/lib -maxdepth 8 -name npm-cli.js -type f 2>/dev/null | "${HEAD_CMD:-head}" -20)
fi

run_npm() {
  if [[ -n "${NPM}" ]]; then
    "${NPM}" "$@"
  elif [[ -n "${NODE_BIN}" && -n "${NPM_CLI}" ]]; then
    "${NODE_BIN}" "${NPM_CLI}" "$@"
  else
    echo "npm not found. id=$(id 2>/dev/null) HOME=${HOME:-} pwd=${PWD}" >&2
    echo "--- Plesk chroot: if SSH is off for this user, /usr and /opt are usually invisible. See README. ---" >&2
    "${LS_CMD}" -la . 2>&1 || true
    "${LS_CMD}" -la "${HOME:-.}" 2>&1 || true
    "${LS_CMD}" -la /opt 2>&1 || true
    "${LS_CMD}" -la /usr/bin/npm 2>&1 || true
    echo "--- hint: install Node via nvm in HOME, or set ${REPO_ROOT}/.plesk-node-env.sh ---" >&2
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
