"""Tests for the full-universe scan.

The behaviour under test is the thing threshold-filtered output cannot do:
report symbols that did NOT trigger, with the indicator values explaining why,
so "nothing fired today" is distinguishable from "something is broken".
"""

from __future__ import annotations

import pandas as pd
import pytest

from app.config import Config
from app.scan import ScanRow, format_scan, scan_universe


class _Provider:
    """Price provider stub: maps symbol -> frame, or an exception to raise."""

    def __init__(self, data: dict):
        self.data = data

    def get_history(self, symbol: str, lookback_days: int = 400):
        value = self.data[symbol]
        if isinstance(value, Exception):
            raise value
        return value


def _ohlcv(rows: int = 260, start: float = 100.0) -> pd.DataFrame:
    """A calm, gently rising series — enough history, no setup."""
    idx = pd.date_range("2025-01-01", periods=rows, freq="B")
    close = pd.Series([start + i * 0.05 for i in range(rows)], index=idx)
    return pd.DataFrame(
        {
            "open": close * 0.999,
            "high": close * 1.004,
            "low": close * 0.996,
            "close": close,
            "volume": pd.Series([1_000_000] * rows, index=idx),
        }
    )


@pytest.fixture
def cfg(monkeypatch):
    for name in ("WATCHLIST", "T212_API_KEY", "SIGNAL_THRESHOLD"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("WATCHLIST", "AAA,BBB")
    return Config()


class TestScanUniverse:
    def test_non_triggering_symbols_are_still_reported(self, cfg):
        """The whole point: a quiet symbol must not vanish from the report."""
        rows = scan_universe(cfg, provider=_Provider({"AAA": _ohlcv(), "BBB": _ohlcv()}))
        assert [r.symbol for r in rows] == ["BBB", "AAA"]  # tie -> symbol desc
        assert all(r.ok for r in rows)
        assert all(r.triggered_rules == [] for r in rows)

    def test_blockers_carry_the_actual_indicator_values(self, cfg):
        rows = scan_universe(cfg, provider=_Provider({"AAA": _ohlcv(), "BBB": _ohlcv()}))
        blockers = rows[0].blockers
        assert blockers, "a non-triggering symbol should explain why"
        # Details are diagnostics, not empty placeholders.
        assert all(isinstance(v, str) and v for v in blockers.values())

    def test_short_history_becomes_an_error_row_not_a_disappearance(self, cfg):
        rows = scan_universe(cfg, provider=_Provider({"AAA": _ohlcv(50), "BBB": _ohlcv()}))
        bad = next(r for r in rows if r.symbol == "AAA")
        assert bad.ok is False
        assert "50 rows" in bad.error
        assert len(rows) == 2  # still reported

    def test_a_failing_symbol_does_not_abort_the_scan(self, cfg):
        rows = scan_universe(
            cfg, provider=_Provider({"AAA": RuntimeError("feed down"), "BBB": _ohlcv()})
        )
        assert len(rows) == 2
        failed = next(r for r in rows if r.symbol == "AAA")
        assert failed.error == "feed down"
        assert next(r for r in rows if r.symbol == "BBB").ok

    def test_explicit_symbols_override_the_universe(self, cfg):
        rows = scan_universe(cfg, symbols=["ZZZ"], provider=_Provider({"ZZZ": _ohlcv()}))
        assert [r.symbol for r in rows] == ["ZZZ"]

    def test_results_are_ranked_by_score(self):
        rows = sorted(
            [ScanRow("LOW", 0.10), ScanRow("HIGH", 0.90), ScanRow("MID", 0.50)],
            key=lambda r: (r.composite_score, r.symbol),
            reverse=True,
        )
        assert [r.symbol for r in rows] == ["HIGH", "MID", "LOW"]


class TestSerialisation:
    def test_blockers_can_be_omitted_to_bound_payload_size(self):
        row = ScanRow("AAA", 0.2, blockers={"oversold_bounce": "rsi 45->46"})
        assert "why_not_triggered" in row.to_dict(include_blockers=True)
        assert "why_not_triggered" not in row.to_dict(include_blockers=False)

    def test_error_rows_report_the_error_instead_of_blockers(self):
        row = ScanRow("AAA", error="feed down", blockers={"x": "y"})
        data = row.to_dict()
        assert data["error"] == "feed down"
        assert "why_not_triggered" not in data


class TestFormatting:
    def test_quiet_day_is_stated_as_normal_with_the_blocking_numbers(self):
        rows = [ScanRow("AAA", 0.0, blockers={"oversold_bounce": "rsi 45.2->46.1"})]
        text = format_scan(rows, threshold=0.4)
        assert "Nothing triggered" in text
        assert "normal" in text
        assert "rsi 45.2->46.1" in text

    def test_triggered_symbols_above_threshold_are_marked(self):
        rows = [
            ScanRow("AAA", 0.72, triggered_rules=["oversold_bounce"]),
            ScanRow("BBB", 0.20, triggered_rules=["macd_bullish_crossover"]),
        ]
        text = format_scan(rows, threshold=0.4)
        assert "* AAA" in text
        assert "  BBB" in text
        assert "2 symbol(s) triggered, 1 above threshold." in text

    def test_error_rows_render_without_crashing(self):
        text = format_scan([ScanRow("AAA", error="feed down")], threshold=0.4)
        assert "error: feed down" in text

    def test_empty_scan_is_handled(self):
        assert "No symbols scanned." in format_scan([], threshold=0.4)


class TestAgentTool:
    def test_tool_reports_a_quiet_result_as_normal(self, cfg, monkeypatch):
        from app import agent

        monkeypatch.setattr(agent, "_context", lambda: (cfg, _Provider({"AAA": _ohlcv(), "BBB": _ohlcv()})))
        out = agent.tool_scan_universe()
        assert out["scanned"] == 2
        assert out["triggered_count"] == 0
        assert "normal" in out["note"]
        assert out["symbol_source"] == "watchlist"

    def test_tool_surfaces_missing_symbols_instead_of_raising(self, monkeypatch):
        from app import agent

        for name in ("WATCHLIST", "T212_API_KEY"):
            monkeypatch.delenv(name, raising=False)
        monkeypatch.setattr(agent, "_context", lambda: (Config(), _Provider({})))
        out = agent.tool_scan_universe()
        assert out["scanned"] == 0
        assert "WATCHLIST" in out["note"]
