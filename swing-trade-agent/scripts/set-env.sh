#!/usr/bin/env bash
# Set one variable in .env safely, without shell quoting pitfalls.
#
#   bash scripts/set-env.sh SUPABASE_URL
#   bash scripts/set-env.sh SUPABASE_SERVICE_ROLE_KEY
#   bash scripts/set-env.sh WATCHLIST
#
# Prompts for the value (hidden for secrets), writes it via python so quotes,
# spaces and JWT dots can't break anything, and normalises common paste
# mistakes (a doubled https://, a trailing slash, surrounding quotes).
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # -> swing-trade-agent/
ENV_FILE="$PWD/.env"

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "Usage: bash scripts/set-env.sh <VARIABLE_NAME>" >&2
  echo "  e.g. bash scripts/set-env.sh SUPABASE_URL" >&2
  exit 1
fi
case "$NAME" in
  [A-Za-z_]*) ;;
  *) echo "'$NAME' is not a valid variable name." >&2; exit 1 ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example .env
  echo "Created a new .env"
fi

# Hide typing for anything secret-shaped.
HIDE=0
case "$NAME" in
  *KEY*|*SECRET*|*TOKEN*|*PASSWORD*) HIDE=1 ;;
esac

VALUE="${2:-}"
if [ -z "$VALUE" ]; then
  echo
  echo "Paste the value for $NAME and press Enter."
  if [ "$HIDE" -eq 1 ]; then
    echo "(Nothing will appear as you paste — that's deliberate.)"
    printf '%s: ' "$NAME"
    read -rs VALUE
    echo
  else
    printf '%s: ' "$NAME"
    read -r VALUE
  fi
fi

if [ -z "$VALUE" ]; then
  echo "Nothing entered — .env unchanged." >&2
  exit 1
fi

NAME="$NAME" VALUE="$VALUE" python3 - "$ENV_FILE" <<'PY'
import os, re, sys, pathlib

path = pathlib.Path(sys.argv[1])
name = os.environ["NAME"]
value = os.environ["VALUE"].strip()

# Strip surrounding quotes someone may have pasted along with the value.
if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
    value = value[1:-1].strip()

if name.endswith("_URL"):
    # A doubled scheme is the classic copy-paste-into-a-placeholder mistake.
    value = re.sub(r"^(https?://)+", "", value)
    value = "https://" + value.rstrip("/")

lines = path.read_text().splitlines()
out, replaced = [], False
for line in lines:
    if line.strip().startswith(f"{name}=") and not replaced:
        out.append(f"{name}={value}")
        replaced = True
    else:
        out.append(line)
if not replaced:
    out.append(f"{name}={value}")
path.write_text("\n".join(out) + "\n")

shown = value if not any(t in name for t in ("KEY", "SECRET", "TOKEN", "PASSWORD")) \
    else f"{value[:6]}…{value[-4:]} ({len(value)} chars)"
print(f"Set {name}={shown}")
PY

chmod 600 "$ENV_FILE" 2>/dev/null || true
echo "Saved to $ENV_FILE — verify with:  make doctor"
