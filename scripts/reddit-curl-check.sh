#!/usr/bin/env bash
# Run on the same machine as production (e.g. Plesk SSH) to see if Reddit returns JSON or blocks the host.
# Usage:
#   ./scripts/reddit-curl-check.sh 'https://www.reddit.com/r/ukvisa/comments/1hkp9zl/naturalisation_citizenship_application_processing/'
#
# Expect: HTTP 200 and body starting with "[". If you see "<!" it is HTML (block / error page).

set -euo pipefail
THREAD_URL="${1:?Usage: $0 '<reddit thread URL>'}"
UA="${REDDIT_USER_AGENT:-naturalisation-tracker/0.1 (server curl check; contact via site)}"
BASE="${THREAD_URL%/}"
JSON_URL="${BASE}.json?raw_json=1&limit=5"
CODE=$(curl -sS -o /tmp/reddit-curl-check-body.txt -w "%{http_code}" -A "$UA" "$JSON_URL") || true
echo "HTTP status: $CODE"
echo "URL: $JSON_URL"
head -c 300 /tmp/reddit-curl-check-body.txt | tr -d '\r'
echo
