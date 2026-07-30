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

# Make sure a .env exists at all — the app reads keys from swing-trade-agent/.env.
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null && echo "Created $PWD/.env (from .env.example)."
fi

# Warn (don't block) if there's no Anthropic key — the page loads, chatting 503s.
if ! "$PY" -c "from app.config import load_config; import sys; sys.exit(0 if load_config().anthropic_api_key else 1)" >/dev/null 2>&1; then
  echo "⚠  No ANTHROPIC_API_KEY found in $PWD/.env" >&2
  echo "   The page will load, but chatting returns 'not configured on the server'." >&2
  echo "   Fix it with:   bash scripts/set-key.sh" >&2
fi

# First run: install frontend deps if missing.
if [ ! -d web/node_modules ]; then
  echo "Installing frontend deps (first run only)…"
  ( cd web && npm install ) || { echo "npm install failed — is Node >= 18.17 installed?" >&2; exit 1; }
fi

# Free a TCP port left held by a previous run that didn't shut down cleanly
# (common in Codespaces: Ctrl-C kills the launcher but the next/uvicorn worker
# lingers and keeps the port, so the next start fails with EADDRINUSE).
# Try several tools: no single one is guaranteed to exist in every image.
port_pids() {
  local port="$1" pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
    [ -n "$pids" ] || pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
  fi
  if [ -z "$pids" ] && command -v fuser >/dev/null 2>&1; then
    pids=$(fuser "${port}/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true)
  fi
  if [ -z "$pids" ] && command -v ss >/dev/null 2>&1; then
    pids=$(ss -ltnpH "sport = :${port}" 2>/dev/null \
             | grep -oE 'pid=[0-9]+' | cut -d= -f2 || true)
  fi
  # Never target ourselves or our own children.
  echo "$pids" | grep -E '^[0-9]+$' | grep -vx "$$" || true
}

free_port() {
  local port="$1" label="$2" pids tries=0
  pids=$(port_pids "$port")
  [ -n "$pids" ] || return 0

  echo "Port ${port} is busy (${label}) — stopping the leftover process(es) from a previous run."
  kill $pids 2>/dev/null || true

  # Verify it actually freed; next dev re-spawns children, so escalate and
  # re-check rather than assuming one kill + sleep 1 did the job.
  while [ "$tries" -lt 10 ]; do
    sleep 0.5
    pids=$(port_pids "$port")
    [ -n "$pids" ] || { echo "  → port ${port} is free."; return 0; }
    tries=$((tries + 1))
    [ "$tries" -eq 4 ] && kill -9 $pids 2>/dev/null || true
  done

  echo "✖ Port ${port} is STILL held by PID(s): $pids" >&2
  echo "  Another 'make dev' is probably running in a different terminal tab." >&2
  echo "  Close that tab, or run:  kill -9 $pids" >&2
  return 1
}

free_port "$BACKEND_PORT" "backend" || exit 1
free_port 3000 "frontend" || exit 1

# Launch each server in its own process group (setsid) so cleanup can kill the
# whole group — next dev spawns worker children that a plain kill would orphan.
RUN_GROUP() { if command -v setsid >/dev/null 2>&1; then setsid "$@"; else "$@"; fi; }

BACK_PID=""
FRONT_PID=""
cleanup() {
  for pid in "$FRONT_PID" "$BACK_PID"; do
    [ -n "$pid" ] || continue
    kill -- "-${pid}" 2>/dev/null || kill "$pid" 2>/dev/null || true
  done
  pkill -P $$ 2>/dev/null || true
}
trap 'echo; echo "Shutting down…"; cleanup; exit 0' INT TERM
trap cleanup EXIT

echo "▶ backend  : http://127.0.0.1:${BACKEND_PORT}   (uvicorn --reload)"
RUN_GROUP "$PY" -m uvicorn app.web.server:app --reload --port "$BACKEND_PORT" &
BACK_PID=$!

echo "▶ frontend : http://localhost:3000   (next dev)"
RUN_GROUP bash -c 'cd web && exec npm run dev -- -p 3000' &
FRONT_PID=$!

echo "Both starting — open http://localhost:3000   (Ctrl-C stops both)"
wait
