#!/usr/bin/env bash
# Start backend Nest microservices (api/worker/sms/connectors/reports) + Next.js dev.
#
# Usage (from frontend/):
#   npm run dev:all
#
# Ctrl+C stops Next.js and the backend microservice launcher.

set -euo pipefail

FRONTEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ROOT="$(cd "$FRONTEND_ROOT/../backend" && pwd)"
MS_SCRIPT="$BACKEND_ROOT/scripts/startup/dev-microservices.sh"

if [[ ! -f "$MS_SCRIPT" ]]; then
    echo "Backend microservices script not found: $MS_SCRIPT" >&2
    exit 1
fi

MS_PID=""
cleanup() {
    trap - EXIT INT TERM
    if [[ -n "$MS_PID" ]] && kill -0 "$MS_PID" 2>/dev/null; then
        echo ""
        echo "Stopping backend microservices..."
        kill -INT "$MS_PID" 2>/dev/null || true
        wait "$MS_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

echo "Starting backend microservices (includes reports on :3006)..."
bash "$MS_SCRIPT" &
MS_PID=$!

cd "$FRONTEND_ROOT"
exec npm run dev
