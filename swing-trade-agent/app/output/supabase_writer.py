"""Persist signal reports to a Supabase ``signals`` table.

Degrades gracefully: if Supabase isn't configured (or the SDK isn't installed)
this is a no-op that returns 0, so the pipeline still runs and prints/emails the
digest. See ``supabase/0001_signals.sql`` for the table + RLS.
"""

from __future__ import annotations

import datetime as dt

from app.config import Config, load_config
from app.output.models import SignalReport


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
    rows = [rep.to_row() for rep in reports]
    try:
        client.table("signals").insert(rows).execute()
    except Exception:  # pragma: no cover - network dependent
        return 0
    return len(rows)
