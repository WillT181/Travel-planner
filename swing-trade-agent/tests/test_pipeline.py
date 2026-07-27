"""Tests for pipeline orchestration (threshold, reasoning wiring, dry-run).

These use a fake in-memory price provider and the deterministic reasoning
fallback, so no network or API key is required.
"""

from __future__ import annotations

import numpy as np

from app.config import Config
from app.output.models import SignalReport
from app.pipeline import generate_signals, run_pipeline
from app.prices.provider import PriceProvider, PriceProviderError
from app.signals.models import RuleResult, Signal
from tests.conftest import make_ohlcv


class _FakeProvider(PriceProvider):
    name = "fake"

    def __init__(self, frames: dict):
        self.frames = frames
        self.requested: list[str] = []

    def get_history(self, symbol: str, lookback_days: int = 400):
        self.requested.append(symbol)
        if symbol not in self.frames:
            raise PriceProviderError(f"no data for {symbol}")
        return self.frames[symbol]


def test_generate_signals_skips_short_and_missing():
    long_series = make_ohlcv(100 + np.cumsum(np.random.default_rng(1).normal(0, 1, 260)))
    short_series = make_ohlcv(np.linspace(100, 110, 30))
    provider = _FakeProvider({"GOOD": long_series, "SHORT": short_series})
    cfg = Config(history_days=400)

    signals = generate_signals(cfg, ["GOOD", "SHORT", "MISSING"], provider)

    names = [s.symbol for s in signals]
    assert "GOOD" in names  # enough history -> a Signal is built
    assert "SHORT" not in names  # <210 rows -> skipped
    assert "MISSING" not in names  # provider error -> skipped
    assert provider.requested == ["GOOD", "SHORT", "MISSING"]


def test_run_pipeline_filters_by_threshold_and_builds_reports(monkeypatch):
    high = Signal("HIGH", "long", 0.80, [RuleResult("oversold_bounce", True, 0.8)],
                  key_levels={"close": 110.0, "sma_200": 100.0},
                  suggested_stop=106.0, atr=2.0)
    low = Signal("LOW", "neutral", 0.10, [])

    monkeypatch.setattr("app.pipeline.generate_signals", lambda *a, **k: [high, low])

    cfg = Config(anthropic_api_key=None, signal_threshold=0.5)
    reports = run_pipeline(
        config=cfg, symbols=["HIGH", "LOW"], use_cache=False, write=False
    )

    assert len(reports) == 1
    rep = reports[0]
    assert isinstance(rep, SignalReport)
    assert rep.signal.symbol == "HIGH"
    assert "HIGH" in rep.rationale  # deterministic fallback rationale


def test_run_pipeline_explicit_symbols_do_not_touch_t212(monkeypatch):
    # If _get_symbols tried to reach T212, this would raise; explicit symbols
    # must bypass it entirely.
    def _boom(*a, **k):
        raise AssertionError("T212 should not be called with explicit symbols")

    monkeypatch.setattr("app.portfolio.fetch_positions", _boom)
    monkeypatch.setattr("app.pipeline.generate_signals", lambda *a, **k: [])

    reports = run_pipeline(
        config=Config(anthropic_api_key=None),
        symbols=["AAPL"],
        use_cache=False,
        write=False,
    )
    assert reports == []
