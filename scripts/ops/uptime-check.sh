#!/usr/bin/env bash
# TASK-005: one uptime probe, used by .github/workflows/uptime.yml (also runnable by hand).
#
#   bash scripts/ops/uptime-check.sh <name> <url> [expected-body-substring]
#
# Passes only when the final attempt returns HTTP 200, the body contains the expected
# substring (if given) and the total time is within UPTIME_SLOW_MS. A failed first attempt
# is retried once after UPTIME_RETRY_WAIT seconds: Render's free plan sleeps after ~15
# minutes idle and a cold start takes 30-60 s, so one slow/failed probe is not an outage.
#
# Environment: UPTIME_TIMEOUT (seconds per attempt, default 60), UPTIME_SLOW_MS (default 8000),
#              UPTIME_RETRY_WAIT (default 10), UPTIME_ATTEMPTS (default 2)
set -uo pipefail

name="${1:?usage: uptime-check.sh <name> <url> [expect]}"
url="${2:?usage: uptime-check.sh <name> <url> [expect]}"
expect="${3:-}"
timeout="${UPTIME_TIMEOUT:-60}"
slow_ms="${UPTIME_SLOW_MS:-8000}"
wait_s="${UPTIME_RETRY_WAIT:-10}"
attempts="${UPTIME_ATTEMPTS:-2}"

body="$(mktemp)"; trap 'rm -f "$body"' EXIT
reason=""
for i in $(seq 1 "$attempts"); do
  out="$(curl -sS -L --max-redirs 3 -o "$body" -w '%{http_code} %{time_total}' --max-time "$timeout" "$url" 2>&1)"
  rc=$?
  code="${out%% *}"; secs="${out##* }"
  if [ $rc -ne 0 ]; then
    reason="curl error (exit $rc), no HTTP answer (refused, DNS, TLS or no reply within ${timeout}s)"; ms=0
  else
    ms="$(awk -v s="$secs" 'BEGIN{printf "%d", s*1000}')"
    if [ "$code" != 200 ]; then reason="HTTP $code (expected 200) in ${ms} ms"
    elif [ -n "$expect" ] && ! grep -q -- "$expect" "$body"; then reason="HTTP 200 but body does not contain '$expect' (${ms} ms)"
    elif [ "$ms" -gt "$slow_ms" ]; then reason="HTTP 200 but slow: ${ms} ms > ${slow_ms} ms"
    else reason=""; break
    fi
  fi
  echo "uptime: $name attempt $i/$attempts: $reason" >&2
  [ "$i" -lt "$attempts" ] && sleep "$wait_s"
done

if [ -z "$reason" ]; then
  echo "uptime: $name OK (HTTP $code, ${ms} ms)"
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "| $name | OK | HTTP $code | ${ms} ms |" >>"$GITHUB_STEP_SUMMARY"
  exit 0
fi
echo "::error title=$name is DOWN or slow::$reason"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "| $name | **FAIL** | $reason | |" >>"$GITHUB_STEP_SUMMARY"
exit 1
