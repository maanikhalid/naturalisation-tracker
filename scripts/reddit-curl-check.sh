#!/usr/bin/env bash
# Run on the same machine as production (e.g. Plesk SSH) to see if Reddit returns JSON or blocks the host.
# Usage:
#   ./scripts/reddit-curl-check.sh 'https://www.reddit.com/r/ukvisa/comments/1hkp9zl/...'
#
# Expect: HTTP 200 and body starting with "[". If you see "<!" it is HTML (often 403 block on hosting IPs).
# If 403 on server but 200 on laptop, set a proxy and retry:
#   REDDIT_HTTPS_PROXY=http://user:pass@host:port ./scripts/reddit-curl-check.sh 'https://...'

set -euo pipefail
THREAD_URL="${1:?Usage: $0 '<reddit thread URL>'}"
UA="${REDDIT_USER_AGENT:-naturalisation-tracker/0.1 (server curl check; contact via site)}"
BASE="${THREAD_URL%/}"
JSON_URL="${BASE}.json?raw_json=1&limit=5"
TMP="${TMPDIR:-/tmp}/reddit-curl-check-$$.txt"
CURL_PROXY=()
if [ -n "${REDDIT_HTTPS_PROXY:-}" ]; then
  CURL_PROXY=(-x "$REDDIT_HTTPS_PROXY")
  echo "Using REDDIT_HTTPS_PROXY"
elif [ -n "${HTTPS_PROXY:-}" ]; then
  CURL_PROXY=(-x "$HTTPS_PROXY")
  echo "Using HTTPS_PROXY"
fi
CODE=$(curl -sS "${CURL_PROXY[@]}" -o "$TMP" -w "%{http_code}" -A "$UA" "$JSON_URL") || true
echo "HTTP status: $CODE"
echo "URL: $JSON_URL"
head -c 300 "$TMP" | tr -d '\r'
echo
rm -f "$TMP"
