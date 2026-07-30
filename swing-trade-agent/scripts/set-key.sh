#!/usr/bin/env bash
# Create .env (from .env.example) if missing and set ANTHROPIC_API_KEY in it.
# Interactive and non-technical-friendly: prompts for the key, never echoes it,
# never prints it back, and verifies the app can actually read it afterwards.
#
#   bash scripts/set-key.sh            # prompt for the key
#   bash scripts/set-key.sh sk-ant-... # or pass it as an argument
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # -> swing-trade-agent/
ENV_FILE="$PWD/.env"

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example .env
  echo "Created a new .env"
fi
echo "Editing: $ENV_FILE"

KEY="${1:-}"
if [ -z "$KEY" ]; then
  echo
  echo "Paste your Anthropic API key and press Enter."
  echo "(Get one at https://console.anthropic.com -> API keys.)"
  echo "Nothing will appear as you paste — that's deliberate, it keeps the key hidden."
  printf 'Key: '
  read -rs KEY
  echo
fi

# Trim whitespace and strip accidental surrounding quotes.
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
KEY="${KEY%\"}"; KEY="${KEY#\"}"
KEY="${KEY%\'}"; KEY="${KEY#\'}"

if [ -z "$KEY" ]; then
  echo "No key entered — nothing changed." >&2
  exit 1
fi
case "$KEY" in
  sk-ant-*) ;;
  *) echo "⚠  That does not look like an Anthropic key (they start with 'sk-ant-')." >&2
     echo "   Writing it anyway, but double-check if the app still says it is missing." >&2 ;;
esac

# Replace the ANTHROPIC_API_KEY line in place (or append if absent). Written via
# python to avoid any shell quoting/escaping surprises with the key's contents.
KEY="$KEY" python3 - "$ENV_FILE" <<'PY'
import os, sys, pathlib
path = pathlib.Path(sys.argv[1])
key = os.environ["KEY"]
lines = path.read_text().splitlines()
out, replaced = [], False
for line in lines:
    if line.strip().startswith("ANTHROPIC_API_KEY=") and not replaced:
        out.append(f"ANTHROPIC_API_KEY={key}")
        replaced = True
    else:
        out.append(line)
if not replaced:
    out.append(f"ANTHROPIC_API_KEY={key}")
path.write_text("\n".join(out) + "\n")
PY

chmod 600 "$ENV_FILE" 2>/dev/null || true

# Verify through the app's own config loader — the real test.
PY_BIN=$([ -x .venv/bin/python ] && echo .venv/bin/python || echo python3)
if "$PY_BIN" -c "
import sys
sys.path.insert(0, '.')
from app.config import load_config
sys.exit(0 if (load_config().anthropic_api_key or '').startswith('sk-ant-') else 1)
" >/dev/null 2>&1; then
  echo "✅ Key saved and the app can read it. Now run:  make dev"
else
  echo "❌ Saved, but the app still cannot read the key." >&2
  echo "   Check for a stray second .env: ls -la '$ENV_FILE'" >&2
  exit 1
fi
