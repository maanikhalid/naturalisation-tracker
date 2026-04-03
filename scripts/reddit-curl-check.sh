#!/usr/bin/env bash
# Run on the same machine as production (e.g. Plesk SSH) to see if Reddit returns JSON or blocks the host.
#
# Usage (thread URL is required):
#   ./scripts/reddit-curl-check.sh 'https://www.reddit.com/r/ukvisa/comments/1hkp9zl/...'
#
# Optional proxy — use a REAL hostname/IP, not the literal characters "..." from docs:
#   REDDIT_HTTPS_PROXY='http://USER:PASS@proxy.example.com:8080' ./scripts/reddit-curl-check.sh 'https://...'
#
# Expect: HTTP 200 and body starting with "[". "<!" in the body is HTML (often 403 on hosting IPs).
# "Could not resolve proxy" means the proxy URL is wrong or DNS cannot resolve the proxy host.

set -uo pipefail
THREAD_URL="${1:?Usage: $0 '<reddit thread URL>'}"
UA="${REDDIT_USER_AGENT:-naturalisation-tracker/0.1 (server curl check; contact via site)}"
BASE="${THREAD_URL%/}"
JSON_URL="${BASE}.json?raw_json=1&limit=5"

if [[ "${REDDIT_HTTPS_PROXY:-}" == *"..."* ]] || [[ "${HTTPS_PROXY:-}" == *"..."* ]]; then
  echo "Error: proxy URL still contains \"...\" — replace with your real proxy host (e.g. proxy.example.com:8080)." >&2
  exit 1
fi

TMP=""
cleanup() { rm -f "$TMP"; }
TMP=$(mktemp "${TMPDIR:-/tmp}/reddit-curl-check.XXXXXX")
trap cleanup EXIT

CURL_PROXY=()
if [ -n "${REDDIT_HTTPS_PROXY:-}" ]; then
  CURL_PROXY=(-x "$REDDIT_HTTPS_PROXY")
  echo "Using REDDIT_HTTPS_PROXY (host must resolve from this server)"
elif [ -n "${HTTPS_PROXY:-}" ]; then
  CURL_PROXY=(-x "$HTTPS_PROXY")
  echo "Using HTTPS_PROXY"
fi

ERRFILE="${TMPDIR:-/tmp}/reddit-curl-check-curlerr-$$.txt"
CODE=$(curl -sS "${CURL_PROXY[@]}" -o "$TMP" -w "%{http_code}" -A "$UA" "$JSON_URL" 2>"$ERRFILE") || true
if [ ! -s "$TMP" ] && [ -s "$ERRFILE" ]; then
  echo "curl stderr:" >&2
  cat "$ERRFILE" >&2
fi
rm -f "$ERRFILE"

echo "HTTP status: ${CODE:-000}"
echo "URL: $JSON_URL"
if [ -f "$TMP" ] && [ -s "$TMP" ]; then
  head -c 300 "$TMP" | tr -d '\r'
  echo
else
  echo "(empty or missing response body — connection/proxy/DNS failed before any data was saved)"
fi
