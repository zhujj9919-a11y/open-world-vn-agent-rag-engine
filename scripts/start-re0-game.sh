#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${RE0_HOST:-127.0.0.1}"
PORT="${RE0_PORT:-8000}"
URL="http://${HOST}:${PORT}/?re0_recover=1&api_guard=1"
LOG_DIR="${ROOT_DIR}/data/default-user/re0-engine/runtime"
LOG_FILE="${LOG_DIR}/re0-game-server.log"
PID_FILE="${LOG_DIR}/re0-game-server.pid"
READY_TIMEOUT_SECONDS="${RE0_READY_TIMEOUT_SECONDS:-45}"

export PATH="/Users/mac/miniconda3/envs/sillytavern/bin:/Applications/Codex.app/Contents/bin:${PATH}"

mkdir -p "${LOG_DIR}"
cd "${ROOT_DIR}"

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found. Expected it in PATH or /Users/mac/miniconda3/envs/sillytavern/bin."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "npm not found. Expected it in PATH or /Users/mac/miniconda3/envs/sillytavern/bin."
    exit 1
fi

if [ ! -d "${ROOT_DIR}/node_modules" ]; then
    echo "node_modules is missing. Installing project dependencies..."
    npm install --no-audit --no-fund
fi

is_ready() {
    curl -fsSI --max-time 10 "${URL}" >/dev/null 2>&1
}

open_game() {
    echo "Opening ${URL}"
    open "${URL}" >/dev/null 2>&1 || true
}

existing_pid=""
if command -v lsof >/dev/null 2>&1; then
    existing_pid="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
fi

if [ -n "${existing_pid}" ]; then
    echo "Re:0/SillyTavern appears to already be listening on port ${PORT} (pid ${existing_pid})."
    if is_ready; then
        open_game
    else
        echo "Port ${PORT} is occupied, but the server did not answer ${URL} within 10 seconds."
        echo "This is likely a stale or busy process. Stop pid ${existing_pid}, then run this launcher again."
        echo "Command: kill ${existing_pid}"
        exit 1
    fi
    exit 0
fi

echo "Starting Re:0 visual novel game..."
echo "Root: ${ROOT_DIR}"
echo "URL:  ${URL}"
echo "Log:  ${LOG_FILE}"
echo "Press Ctrl+C to stop the server."

node server.js --disableCsrf "$@" 2>&1 | tee -a "${LOG_FILE}" &
server_pid=$!
echo "${server_pid}" > "${PID_FILE}"

cleanup() {
    if kill -0 "${server_pid}" >/dev/null 2>&1; then
        kill "${server_pid}" >/dev/null 2>&1 || true
    fi
}
trap cleanup INT TERM

echo "Waiting for server readiness..."
for ((i = 1; i <= READY_TIMEOUT_SECONDS; i += 1)); do
    if is_ready; then
        echo "Server is ready."
        open_game
        wait "${server_pid}"
        exit $?
    fi
    sleep 1
done

echo "Server did not become ready within ${READY_TIMEOUT_SECONDS}s."
echo "Recent log:"
tail -n 80 "${LOG_FILE}" || true
cleanup
exit 1
