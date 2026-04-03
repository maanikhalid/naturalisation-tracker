#!/usr/bin/env bash
# Plesk Git "Additional deployment actions" — minimal, debuggable.
# Prerequisite: subscription user can run Node/npm (see README — chroot breaks hooks).
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/sbin:/usr/local/bin:/opt/plesk/node/22/bin:/opt/plesk/node/20/bin:/opt/plesk/node/18/bin:${PATH}"
export CI=1
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
export PLESK_SKIP_TYPESCRIPT=1

_script="${BASH_SOURCE[0]}"
_sdir=${_script%/*}
[[ "${_script}" == */* ]] || _sdir=.
REPO_ROOT="$(cd "${_sdir}/.." && pwd)"

# Optional: create on server only — export PATH=..., or NODE_BIN=, NPM_CLI= for odd setups
if [[ -f "${REPO_ROOT}/.plesk-deploy-env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.plesk-deploy-env.sh"
fi

cd "${REPO_ROOT}/web"

npm ci --include=dev --no-audit --no-fund
npm run prisma:generate
npm run prisma:push
npm run build

echo "Deployment actions complete."
