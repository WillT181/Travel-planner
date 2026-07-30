"""Tests for symbol-universe resolution.

Regression guard for the failure that made the whole app look broken without a
broker account: every portfolio-wide entry point called Trading 212 directly, so
with no T212 key there were no symbols — and signals, backtests and the daily
briefing were all silently empty.
"""

from __future__ import annotations

import pytest

from app.config import Config, _split_symbols
from app.symbols import (
    SOURCE_EXPLICIT,
    SOURCE_PORTFOLIO,
    SOURCE_WATCHLIST,
    SymbolSourceError,
    resolve_symbols,
)


class _Position:
    def __init__(self, ticker: str, quantity: float = 1.0):
        self.ticker = ticker
        self.quantity = quantity


def _config(monkeypatch, *, watchlist: str | None = None, t212_key: str | None = None):
    for name in ("WATCHLIST", "T212_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    if watchlist is not None:
        monkeypatch.setenv("WATCHLIST", watchlist)
    if t212_key is not None:
        monkeypatch.setenv("T212_API_KEY", t212_key)
    return Config()


def _patch_positions(monkeypatch, result):
    def fake_fetch_positions(config=None):
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr("app.portfolio.fetch_positions", fake_fetch_positions)


class TestSplitSymbols:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("AAPL,MSFT", ["AAPL", "MSFT"]),
            ("AAPL MSFT", ["AAPL", "MSFT"]),
            ("aapl, msft ,nvda", ["AAPL", "MSFT", "NVDA"]),
            ("AAPL,,MSFT", ["AAPL", "MSFT"]),
            ("AAPL,AAPL,MSFT", ["AAPL", "MSFT"]),  # de-duplicated, order kept
            ("", []),
            (None, []),
        ],
    )
    def test_parsing(self, raw, expected):
        assert _split_symbols(raw) == expected


class TestResolveSymbols:
    def test_explicit_wins_and_never_touches_the_broker(self, monkeypatch):
        cfg = _config(monkeypatch, watchlist="AAPL", t212_key="key")
        _patch_positions(monkeypatch, RuntimeError("must not be called"))
        universe = resolve_symbols(cfg, ["tsla", " nvda "])
        assert universe.symbols == ["TSLA", "NVDA"]
        assert universe.source == SOURCE_EXPLICIT

    def test_watchlist_used_when_no_broker_key(self, monkeypatch):
        cfg = _config(monkeypatch, watchlist="AAPL,MSFT")
        universe = resolve_symbols(cfg)
        assert universe.symbols == ["AAPL", "MSFT"]
        assert universe.source == SOURCE_WATCHLIST

    def test_portfolio_preferred_over_watchlist(self, monkeypatch):
        cfg = _config(monkeypatch, watchlist="AAPL", t212_key="key")
        _patch_positions(monkeypatch, [_Position("TSLA"), _Position("NVDA")])
        universe = resolve_symbols(cfg)
        assert universe.symbols == ["TSLA", "NVDA"]
        assert universe.source == SOURCE_PORTFOLIO

    def test_zero_quantity_positions_are_ignored(self, monkeypatch):
        cfg = _config(monkeypatch, t212_key="key")
        _patch_positions(monkeypatch, [_Position("TSLA", 0), _Position("NVDA", 3)])
        assert resolve_symbols(cfg).symbols == ["NVDA"]

    def test_empty_portfolio_falls_back_to_watchlist(self, monkeypatch):
        cfg = _config(monkeypatch, watchlist="AAPL", t212_key="key")
        _patch_positions(monkeypatch, [])
        universe = resolve_symbols(cfg)
        assert universe.symbols == ["AAPL"]
        assert universe.source == SOURCE_WATCHLIST

    def test_broker_failure_falls_back_to_watchlist(self, monkeypatch):
        cfg = _config(monkeypatch, watchlist="AAPL", t212_key="key")
        _patch_positions(monkeypatch, RuntimeError("T212 down"))
        universe = resolve_symbols(cfg)
        assert universe.symbols == ["AAPL"]
        assert universe.source == SOURCE_WATCHLIST

    def test_broker_failure_without_watchlist_raises(self, monkeypatch):
        """Never silently screen nothing when the broker was meant to supply symbols."""
        cfg = _config(monkeypatch, t212_key="key")
        _patch_positions(monkeypatch, RuntimeError("T212 down"))
        with pytest.raises(RuntimeError, match="T212 down"):
            resolve_symbols(cfg)

    def test_no_sources_raises_actionable_error(self, monkeypatch):
        cfg = _config(monkeypatch)
        with pytest.raises(SymbolSourceError, match="WATCHLIST"):
            resolve_symbols(cfg)


class TestPipelineIntegration:
    def test_pipeline_resolves_watchlist_without_broker(self, monkeypatch):
        from app.pipeline import _get_symbols

        cfg = _config(monkeypatch, watchlist="AAPL,MSFT")
        assert _get_symbols(cfg, None) == ["AAPL", "MSFT"]

    def test_agent_backtest_tool_reports_missing_symbols(self, monkeypatch):
        """The tool must return an actionable string, not raise."""
        from app import agent

        cfg = _config(monkeypatch)
        monkeypatch.setattr(agent, "_context", lambda: (cfg, object()))
        out = agent.tool_run_backtest()
        assert "WATCHLIST" in out

    def test_agent_portfolio_tool_explains_missing_broker(self, monkeypatch):
        from app import agent

        cfg = _config(monkeypatch, watchlist="AAPL")
        monkeypatch.setattr(agent, "_context", lambda: (cfg, object()))
        out = agent.tool_get_portfolio()
        assert out["holdings"] == []
        assert "watchlist" in out["note"].lower()
