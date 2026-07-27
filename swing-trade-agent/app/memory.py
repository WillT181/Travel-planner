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


# Composite score at/above which a signal is flagged as anomalous.
HIGH_SCORE = 0.8


def _score(row: dict) -> float:
    try:
        return float(row.get("composite_score") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def daily_briefing(
    config: Config | None = None, days: int = 7, high_score: float = HIGH_SCORE
) -> dict:
    """Assemble an ORGANISED salience bundle for the latest run — not prose.

    Categorises the latest run against the previous one and flags anomalies, so
    the agent can decide what deserves attention. All ranking/judgment stays in
    the agent; this only supplies structured data:

    - ``new_triggers``   — symbols with at least one rule firing that wasn't in
                           the previous run (each carries ``new_rules`` and any
                           ``persisting_rules``).
    - ``persisting``     — symbols whose rules all carried over from last run.
    - ``resolved``       — symbol+rule pairs that stopped since last run.
    - ``expired_symbols``— symbols that dropped out entirely since last run.
    - ``anomalies``      — unusually high composite score, or 2+ rules confirming.
    - ``quiet_day``      — True when nothing is new, resolved, expired, or
                           anomalous (don't manufacture signal).
    """
    config = config or load_config()
    runs = _partition_runs(_fetch_rows(config, since=_since(days)))

    empty = {
        "run": None,
        "previous_run": None,
        "quiet_day": True,
        "new_triggers": [],
        "persisting": [],
        "resolved": [],
        "expired_symbols": [],
        "anomalies": [],
        "counts": {"today_signals": 0, "new_triggers": 0, "persisting": 0,
                   "resolved": 0, "expired_symbols": 0, "anomalies": 0},
        "note": "No signals recorded — quiet day.",
    }
    if not runs:
        return empty

    today_ts, today_rows = runs[0]
    prev_ts, prev_rows = runs[1] if len(runs) > 1 else (None, [])
    prev_pairs = _pairs(prev_rows)
    prev_syms = {r.get("symbol") for r in prev_rows}
    today_syms = {r.get("symbol") for r in today_rows}

    new_triggers, persisting, anomalies = [], [], []
    for row in today_rows:
        sym = row.get("symbol")
        rules = _rules(row)
        score = round(_score(row), 4)
        new_rules = [r for r in rules if (sym, r) not in prev_pairs]
        carried = [r for r in rules if (sym, r) in prev_pairs]
        entry = {
            "symbol": sym,
            "composite_score": score,
            "triggered_rules": rules,
            "new_rules": new_rules,
            "persisting_rules": carried,
            "suggested_stop": row.get("suggested_stop"),
            "as_of": row.get("as_of"),
            "rationale": row.get("rationale"),
        }
        (new_triggers if new_rules else persisting).append(entry)

        if score >= high_score:
            anomalies.append({"symbol": sym, "kind": "high_score", "composite_score": score,
                              "detail": f"composite score {score:.2f} (>= {high_score:.2f})"})
        if len(rules) >= 2:
            anomalies.append({"symbol": sym, "kind": "multi_rule", "composite_score": score,
                              "detail": f"{len(rules)} rules confirming: {', '.join(rules)}"})

    resolved = _fmt_pairs(prev_pairs - _pairs(today_rows))
    expired = sorted(s for s in (prev_syms - today_syms) if s)
    by_score = lambda e: e["composite_score"]  # noqa: E731

    quiet = not (new_triggers or resolved or expired or anomalies)
    return {
        "run": today_ts,
        "previous_run": prev_ts,
        "quiet_day": quiet,
        "new_triggers": sorted(new_triggers, key=by_score, reverse=True),
        "persisting": sorted(persisting, key=by_score, reverse=True),
        "resolved": resolved,
        "expired_symbols": expired,
        "anomalies": anomalies,
        "counts": {
            "today_signals": len(today_rows),
            "new_triggers": len(new_triggers),
            "persisting": len(persisting),
            "resolved": len(resolved),
            "expired_symbols": len(expired),
            "anomalies": len(anomalies),
        },
        "note": "Quiet day — nothing new, resolved, or anomalous." if quiet else "",
    }
