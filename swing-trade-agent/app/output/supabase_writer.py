"""Persist signal reports to a Supabase ``signals`` table.

Degrades gracefully: if Supabase isn't configured (or the SDK isn't installed)
this is a no-op that returns 0, so the pipeline still runs and prints/emails the
digest. See ``supabase/0001_signals.sql`` for the table + RLS.
"""

from __future__ import annotations

import datetime as dt

from app.config import Config, load_config
from app.output.models import SignalReport


def check_supabase(config: Config | None = None) -> dict:
    """Diagnose the Supabase connection: ``{ok, detail, fix, rows}``.

    Every Supabase path in this app degrades silently to "no data" so a run can
    never be broken by a storage outage — which makes a *setup* mistake
    invisible. This turns each failure mode into a specific, actionable message.
    Read-only; it never writes.
    """
    config = config or load_config()

    if not config.supabase_url or not config.supabase_service_role_key:
        missing = [
            name
            for name, value in (
                ("SUPABASE_URL", config.supabase_url),
                ("SUPABASE_SERVICE_ROLE_KEY", config.supabase_service_role_key),
            )
            if not value
        ]
        return {
            "ok": False,
            "detail": f"Not configured ({', '.join(missing)} missing).",
            "fix": "Add them to .env — Supabase dashboard → Project Settings → API.",
            "rows": None,
        }

    try:
        from supabase import create_client
    except ImportError:
        return {
            "ok": False,
            "detail": "The `supabase` package is not installed.",
            "fix": 'pip install -e ".[output]"',
            "rows": None,
        }

    try:
        client = create_client(config.supabase_url, config.supabase_service_role_key)
        resp = client.table("signals").select("timestamp").order(
            "timestamp", desc=True
        ).limit(1).execute()
    except Exception as exc:  # noqa: BLE001 - report, never raise
        text = str(exc)
        lowered = text.lower()
        if "does not exist" in lowered or "relation" in lowered or "pgrst205" in lowered:
            return {
                "ok": False,
                "detail": "Connected, but the `signals` table does not exist.",
                "fix": "Run supabase/0001_signals.sql in the Supabase SQL editor.",
                "rows": None,
            }
        if "invalid" in lowered or "jwt" in lowered or "api key" in lowered:
            return {
                "ok": False,
                "detail": f"Supabase rejected the credentials: {text}",
                "fix": "Check SUPABASE_SERVICE_ROLE_KEY (the service_role key, not anon).",
                "rows": None,
            }
        return {
            "ok": False,
            "detail": f"Could not reach Supabase: {text}",
            "fix": "Check SUPABASE_URL and your network.",
            "rows": None,
        }

    rows = getattr(resp, "data", None) or []
    latest = rows[0].get("timestamp") if rows else None
    return {
        "ok": True,
        "detail": (
            f"Connected; `signals` table reachable. Most recent run: {latest}."
            if latest
            else "Connected; `signals` table exists but is empty (no runs stored yet)."
        ),
        "fix": "" if latest else "Run `python -m app.run run` to store the first run.",
        "rows": len(rows),
    }


def read_todays_signals(
    config: Config | None = None, symbol: str | None = None
) -> list[dict] | None:
    """Return today's stored signal rows (optionally for one symbol).

    Returns ``None`` when Supabase is not configured, the SDK is missing, the
    query fails, or there are no rows for today — the caller treats ``None`` as
    "fall back to live evaluation". Rows are plain dicts (the ``signals`` table
    columns), ordered by ``composite_score`` descending.
    """
    config = config or load_config()
    if not (config.supabase_url and config.supabase_service_role_key):
        return None

    try:
        from supabase import create_client
    except ImportError:  # pragma: no cover - env dependent
        return None

    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    try:
        client = create_client(config.supabase_url, config.supabase_service_role_key)
        query = client.table("signals").select("*").gte("timestamp", today)
        if symbol:
            query = query.eq("symbol", symbol)
        resp = query.order("composite_score", desc=True).execute()
        return (resp.data or None) if getattr(resp, "data", None) else None
    except Exception:  # pragma: no cover - network dependent
        return None


def write_signals(reports: list[SignalReport], config: Config | None = None) -> int:
    """Insert reports into the ``signals`` table. Returns the count written."""
    config = config or load_config()
    if not reports:
        return 0
    if not (config.supabase_url and config.supabase_service_role_key):
        return 0

    try:
        from supabase import create_client
    except ImportError:  # pragma: no cover - env dependent
        return 0

    client = create_client(config.supabase_url, config.supabase_service_role_key)
    # Stamp every row in this run with one timestamp so the memory layer can
    # group rows into runs and diff consecutive runs (app/memory.py).
    run_at = dt.datetime.now(dt.timezone.utc).isoformat()
    rows = []
    for rep in reports:
        row = rep.to_row()
        row["timestamp"] = run_at
        rows.append(row)
    try:
        client.table("signals").insert(rows).execute()
    except Exception:  # pragma: no cover - network dependent
        return 0
    return len(rows)
