#!/usr/bin/env bash
# Boot the FastAPI backend and the Next.js frontend together for local dev.
# Ctrl-C stops both. Mac/Linux (and WSL / Git Bash). On native Windows
# cmd/PowerShell, run the two commands from the README in separate terminals.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # -> swing-trade-agent/

# Prefer the project's virtualenv if `make setup` created one.
if [ -n "${PYTHON:-}" ]; then
  PY="$PYTHON"
elif [ -x ".venv/bin/python" ]; then
  PY=".venv/bin/python"
else
  PY="python3"
fi
BACKEND_PORT="${BACKEND_PORT:-8000}"
export AGENT_API_URL="http://127.0.0.1:${BACKEND_PORT}"

# Pre-flight: are the backend deps installed?
if ! "$PY" -c "import uvicorn, fastapi" >/dev/null 2>&1; then
  echo "Backend deps missing. Run:  make install" >&2
  echo "  (or: pip install -e \".[web,reasoning,prices,output,dev]\")" >&2
  exit 1
fi

# Warn (don't block) if there's no Anthropic key — the page loads, chatting 503s.
if ! "$PY" -c "from app.config import load_config; import sys; sys.exit(0 if load_config().anthropic_api_key else 1)" >/dev/null 2>&1; then
  echo "⚠  ANTHROPIC_API_KEY is not set in .env — the page will load but chatting returns 503." >&2
fi

# First run: install frontend deps if missing.
if [ ! -d web/node_modules ]; then
  echo "Installing frontend deps (first run only)…"
  ( cd web && npm install ) || { echo "npm install failed — is Node >= 18.17 installed?" >&2; exit 1; }
fi

PIDS=()
cleanup() {
  kill "${PIDS[@]}" 2>/dev/null || true
  pkill -P $$ 2>/dev/null || true
}
trap 'echo; echo "Shutting down…"; cleanup; exit 0' INT TERM
trap cleanup EXIT

echo "▶ backend  : http://127.0.0.1:${BACKEND_PORT}   (uvicorn --reload)"
"$PY" -m uvicorn app.web.server:app --reload --port "$BACKEND_PORT" &
PIDS+=("$!")

echo "▶ frontend : http://localhost:3000   (next dev)"
( cd web && exec npm run dev ) &
PIDS+=("$!")

echo "Both starting — open http://localhost:3000   (Ctrl-C stops both)"
wait
