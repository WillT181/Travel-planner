"""Persist signal reports to a Supabase ``signals`` table.

Degrades gracefully: if Supabase isn't configured (or the SDK isn't installed)
this is a no-op that returns 0, so the pipeline still runs and prints/emails the
digest. See ``supabase/0001_signals.sql`` for the table + RLS.
"""

from __future__ import annotations

from app.config import Config, load_config
from app.output.models import SignalReport


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
