"""Persistent memory over the Supabase ``signals`` table.

The pipeline writes one row per flagged signal per run (see
``app/output/supabase_writer.py``, which stamps every row in a run with a single
``timestamp`` so runs are identifiable). These functions read that history back
so the agent can reason across time:

- :func:`fetch_timeline` — one symbol's past signal reports in date order.
- :func:`diff_runs` — what changed between the two most recent runs.

All reads degrade to empty results when Supabase is unconfigured or unavailable,
and :func:`diff_runs` handles the first-ever-run case cleanly (nothing to
compare against).
"""

from __future__ import annotations

import datetime as dt
import json

from app.config import Config, load_config


def _get_client(config: Config):
    """Build a Supabase client, or None if unconfigured / SDK missing.

    Isolated so tests can mock the whole Supabase layer by patching this.
    """
    if not (config.supabase_url and config.supabase_service_role_key):
        return None
    try:
        from supabase import create_client
    except ImportError:  # pragma: no cover - env dependent
        return None
    try:
        return create_client(config.supabase_url, config.supabase_service_role_key)
    except Exception:  # pragma: no cover - network dependent
        return None


def _fetch_rows(config: Config, symbol: str | None = None, since: str | None = None) -> list[dict]:
    """Read signal rows, optionally filtered by symbol and a `since` date."""
    client = _get_client(config)
    if client is None:
        return []
    try:
        query = client.table("signals").select("*")
        if symbol:
            query = query.eq("symbol", symbol)
        if since:
            query = query.gte("timestamp", since)
        resp = query.order("timestamp").execute()
        return list(getattr(resp, "data", None) or [])
    except Exception:  # pragma: no cover - network dependent
        return []


def _since(days: int) -> str:
    day = dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=int(days))
    return day.isoformat()


def _rules(row: dict) -> list[str]:
    """Triggered-rule names from a row (jsonb list, or a JSON string)."""
    value = row.get("triggered_rules")
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except Exception:
            return []
    return list(value or [])


def fetch_timeline(symbol: str, days: int = 30, config: Config | None = None) -> list[dict]:
    """Return ``symbol``'s past signal rows over the last ``days``, oldest first."""
    config = config or load_config()
    rows = _fetch_rows(config, symbol=symbol, since=_since(days))
    return sorted(rows, key=lambda r: r.get("timestamp") or "")


def _partition_runs(rows: list[dict]) -> list[tuple[str, list[dict]]]:
    """Group rows into runs by their ``timestamp``, newest run first."""
    runs: dict[str, list[dict]] = {}
    for row in rows:
        runs.setdefault(row.get("timestamp") or "", []).append(row)
    return sorted(runs.items(), key=lambda kv: kv[0], reverse=True)


def _pairs(rows: list[dict]) -> set[tuple]:
    return {(row.get("symbol"), rule) for row in rows for rule in _rules(row)}


def _fmt_pairs(pairs: set[tuple]) -> list[dict]:
    return [{"symbol": sym, "rule": rule} for sym, rule in sorted(pairs)]


def diff_runs(config: Config | None = None, days: int = 7) -> dict:
    """Compare the latest run to the previous one.

    Returns ``new_symbols`` (symbols in the latest run absent from the previous),
    ``newly_triggered`` (symbol+rule pairs firing now but not last run), and
    ``stopped_triggering`` (firing last run but not now). Empty-history and
    first-run cases are handled with a ``note`` and empty lists.
    """
    config = config or load_config()
    runs = _partition_runs(_fetch_rows(config, since=_since(days)))

    if not runs:
        return {
            "today": None,
            "previous": None,
            "new_symbols": [],
            "newly_triggered": [],
            "stopped_triggering": [],
            "note": "No signal history yet.",
        }

    today_ts, today_rows = runs[0]
    today_syms = {r.get("symbol") for r in today_rows}
    today_pairs = _pairs(today_rows)

    if len(runs) == 1:
        return {
            "today": today_ts,
            "previous": None,
            "new_symbols": sorted(s for s in today_syms if s),
            "newly_triggered": _fmt_pairs(today_pairs),
            "stopped_triggering": [],
            "note": "First run — no previous run to compare against.",
        }

    prev_ts, prev_rows = runs[1]
    prev_syms = {r.get("symbol") for r in prev_rows}
    prev_pairs = _pairs(prev_rows)
    return {
        "today": today_ts,
        "previous": prev_ts,
        "new_symbols": sorted(s for s in (today_syms - prev_syms) if s),
        "newly_triggered": _fmt_pairs(today_pairs - prev_pairs),
        "stopped_triggering": _fmt_pairs(prev_pairs - today_pairs),
        "note": "",
    }
