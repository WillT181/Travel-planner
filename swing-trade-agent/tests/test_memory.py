"""Tests for the persistent-memory layer (Supabase mocked).

The whole Supabase client is replaced by patching ``app.memory._get_client``,
so these tests need no `supabase` package and make no network call.
"""

from __future__ import annotations

from types import SimpleNamespace

from app.config import Config
from app.memory import daily_briefing, diff_runs, fetch_timeline


class _FakeQuery:
    def __init__(self, rows, rec):
        self._rows = rows
        self.rec = rec

    def select(self, *a):
        return self

    def eq(self, col, val):
        self.rec.setdefault("eq", []).append((col, val))
        return self

    def gte(self, col, val):
        self.rec.setdefault("gte", []).append((col, val))
        return self

    def order(self, col, *a, **k):
        self.rec["order"] = col
        return self

    def execute(self):
        return SimpleNamespace(data=self._rows)


class _FakeClient:
    def __init__(self, rows, rec=None):
        self._rows = rows
        self.rec = rec if rec is not None else {}

    def table(self, name):
        self.rec["table"] = name
        return _FakeQuery(self._rows, self.rec)


def _patch(monkeypatch, rows, rec=None):
    monkeypatch.setattr("app.memory._get_client", lambda config: _FakeClient(rows, rec))


_CFG = Config(supabase_url="u", supabase_service_role_key="k")


# --- fetch_timeline --------------------------------------------------------


def test_fetch_timeline_filters_by_symbol_and_sorts_ascending(monkeypatch):
    rows = [
        {"timestamp": "2026-07-03T21:30:00+00:00", "symbol": "AAPL", "triggered_rules": ["golden_cross_momentum"]},
        {"timestamp": "2026-07-01T21:30:00+00:00", "symbol": "AAPL", "triggered_rules": ["oversold_bounce"]},
    ]
    rec: dict = {}
    _patch(monkeypatch, rows, rec)

    out = fetch_timeline("AAPL", days=30, config=_CFG)

    assert [r["timestamp"] for r in out] == [
        "2026-07-01T21:30:00+00:00",
        "2026-07-03T21:30:00+00:00",
    ]  # oldest first
    assert rec["table"] == "signals"
    assert ("symbol", "AAPL") in rec["eq"]
    assert rec["gte"] and rec["gte"][0][0] == "timestamp"  # a since-date filter applied


def test_fetch_timeline_empty_without_supabase(monkeypatch):
    monkeypatch.setattr("app.memory._get_client", lambda config: None)
    assert fetch_timeline("AAPL", config=Config()) == []


# --- diff_runs -------------------------------------------------------------


def test_diff_runs_reports_new_newly_triggered_and_stopped(monkeypatch):
    rows = [
        # previous run
        {"timestamp": "2026-07-01T21:30:00+00:00", "symbol": "AAPL", "triggered_rules": ["golden_cross_momentum"]},
        {"timestamp": "2026-07-01T21:30:00+00:00", "symbol": "MSFT", "triggered_rules": ["macd_bullish_crossover"]},
        # latest run: AAPL persists golden cross + gains oversold; NVDA new; MSFT gone
        {"timestamp": "2026-07-02T21:30:00+00:00", "symbol": "AAPL",
         "triggered_rules": ["golden_cross_momentum", "oversold_bounce"]},
        {"timestamp": "2026-07-02T21:30:00+00:00", "symbol": "NVDA", "triggered_rules": ["ema_pullback_resume"]},
    ]
    _patch(monkeypatch, rows)

    d = diff_runs(config=_CFG)

    assert d["today"] == "2026-07-02T21:30:00+00:00"
    assert d["previous"] == "2026-07-01T21:30:00+00:00"
    assert d["new_symbols"] == ["NVDA"]
    assert {"symbol": "AAPL", "rule": "oversold_bounce"} in d["newly_triggered"]
    assert {"symbol": "NVDA", "rule": "ema_pullback_resume"} in d["newly_triggered"]
    # A rule that persisted is NOT "newly" triggered.
    assert {"symbol": "AAPL", "rule": "golden_cross_momentum"} not in d["newly_triggered"]
    assert {"symbol": "MSFT", "rule": "macd_bullish_crossover"} in d["stopped_triggering"]
    assert d["note"] == ""


def test_diff_runs_first_run_has_no_previous(monkeypatch):
    rows = [
        {"timestamp": "2026-07-02T21:30:00+00:00", "symbol": "AAPL", "triggered_rules": ["golden_cross_momentum"]},
    ]
    _patch(monkeypatch, rows)

    d = diff_runs(config=_CFG)

    assert d["previous"] is None
    assert d["new_symbols"] == ["AAPL"]
    assert {"symbol": "AAPL", "rule": "golden_cross_momentum"} in d["newly_triggered"]
    assert d["stopped_triggering"] == []
    assert "First run" in d["note"]


def test_diff_runs_empty_history(monkeypatch):
    _patch(monkeypatch, [])
    d = diff_runs(config=_CFG)
    assert d["today"] is None and d["previous"] is None
    assert d["new_symbols"] == [] and d["newly_triggered"] == [] and d["stopped_triggering"] == []
    assert "No signal history" in d["note"]


def test_diff_runs_handles_json_string_rules(monkeypatch):
    # Some drivers return jsonb as a string; the diff must still parse it.
    rows = [
        {"timestamp": "2026-07-02T21:30:00+00:00", "symbol": "AAPL", "triggered_rules": '["golden_cross_momentum"]'},
    ]
    _patch(monkeypatch, rows)
    d = diff_runs(config=_CFG)
    assert {"symbol": "AAPL", "rule": "golden_cross_momentum"} in d["newly_triggered"]


# --- daily_briefing (salience bundle) --------------------------------------


def test_daily_briefing_categorises_new_persisting_resolved_and_anomalies(monkeypatch):
    rows = [
        # previous run
        {"timestamp": "2026-07-01T21:30:00+00:00", "symbol": "AAPL",
         "composite_score": 0.60, "triggered_rules": ["golden_cross_momentum"]},
        {"timestamp": "2026-07-01T21:30:00+00:00", "symbol": "MSFT",
         "composite_score": 0.50, "triggered_rules": ["macd_bullish_crossover"]},
        # latest run
        {"timestamp": "2026-07-02T21:30:00+00:00", "symbol": "AAPL",
         "composite_score": 0.62, "triggered_rules": ["golden_cross_momentum"]},  # persists
        {"timestamp": "2026-07-02T21:30:00+00:00", "symbol": "NVDA",
         "composite_score": 0.85, "triggered_rules": ["ema_pullback_resume", "oversold_bounce"]},  # new + anomalous
    ]
    _patch(monkeypatch, rows)

    b = daily_briefing(config=_CFG)

    assert b["quiet_day"] is False
    assert b["run"] == "2026-07-02T21:30:00+00:00"
    assert b["previous_run"] == "2026-07-01T21:30:00+00:00"

    # NVDA is a new trigger; AAPL persists (its rule carried over).
    new_syms = {e["symbol"] for e in b["new_triggers"]}
    persist_syms = {e["symbol"] for e in b["persisting"]}
    assert new_syms == {"NVDA"}
    assert persist_syms == {"AAPL"}
    nvda = b["new_triggers"][0]
    assert set(nvda["new_rules"]) == {"ema_pullback_resume", "oversold_bounce"}

    # MSFT stopped and dropped out entirely.
    assert {"symbol": "MSFT", "rule": "macd_bullish_crossover"} in b["resolved"]
    assert b["expired_symbols"] == ["MSFT"]

    # Anomalies: NVDA's high score AND multi-rule confirmation.
    kinds = {(a["symbol"], a["kind"]) for a in b["anomalies"]}
    assert ("NVDA", "high_score") in kinds
    assert ("NVDA", "multi_rule") in kinds
    assert b["counts"]["today_signals"] == 2


def test_daily_briefing_quiet_day_when_nothing_changes(monkeypatch):
    rows = [
        {"timestamp": "2026-07-01T21:30:00+00:00", "symbol": "AAPL",
         "composite_score": 0.50, "triggered_rules": ["golden_cross_momentum"]},
        {"timestamp": "2026-07-02T21:30:00+00:00", "symbol": "AAPL",
         "composite_score": 0.51, "triggered_rules": ["golden_cross_momentum"]},  # same setup, persists
    ]
    _patch(monkeypatch, rows)

    b = daily_briefing(config=_CFG)

    assert b["quiet_day"] is True
    assert b["new_triggers"] == [] and b["resolved"] == [] and b["anomalies"] == []
    assert {e["symbol"] for e in b["persisting"]} == {"AAPL"}  # routine setup still there
    assert "Quiet day" in b["note"]


def test_daily_briefing_empty_history_is_quiet(monkeypatch):
    _patch(monkeypatch, [])
    b = daily_briefing(config=_CFG)
    assert b["quiet_day"] is True
    assert b["run"] is None
    assert b["new_triggers"] == [] and b["persisting"] == [] and b["anomalies"] == []


def test_daily_briefing_first_run_marks_all_new(monkeypatch):
    rows = [
        {"timestamp": "2026-07-02T21:30:00+00:00", "symbol": "AAPL",
         "composite_score": 0.7, "triggered_rules": ["golden_cross_momentum"]},
    ]
    _patch(monkeypatch, rows)
    b = daily_briefing(config=_CFG)
    assert b["previous_run"] is None
    assert {e["symbol"] for e in b["new_triggers"]} == {"AAPL"}  # nothing prior -> all new
    assert b["quiet_day"] is False
