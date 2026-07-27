"""End-to-end smoke test: the whole pipeline against the T212 DEMO environment.

The Trading 212 HTTP layer is mocked (demo positions) and price data is mocked
(a golden-cross series), so the test exercises every stage — portfolio -> prices
-> indicators -> signals -> reasoning -> digest — with no network access.
"""

from __future__ import annotations

import numpy as np
import requests

from app.config import Config
from app.indicators import add_indicators
from app.output.digest import render_markdown_digest
from app.pipeline import run_pipeline
from app.prices.provider import PriceProvider
from tests.conftest import make_ohlcv


def _golden_cross_series() -> np.ndarray:
    """A close series whose LAST bar is a golden cross (so build_signal fires)."""
    raw = np.concatenate([np.full(210, 100.0), np.linspace(100.0, 170.0, 90)])
    ind = add_indicators(make_ohlcv(raw))
    crossed = (ind["sma_50"].shift(1) <= ind["sma_200"].shift(1)) & (
        ind["sma_50"] > ind["sma_200"]
    )
    idx = int(np.flatnonzero(crossed.to_numpy())[0])
    return raw[: idx + 1]  # truncate so the cross lands on the final bar


class _FakeProvider(PriceProvider):
    name = "fake"

    def __init__(self, series):
        self.series = series
        self.requested: list[str] = []

    def get_history(self, symbol, lookback_days=400):
        self.requested.append(symbol)
        return make_ohlcv(self.series)


class _FakeResp:
    status_code = 200
    headers: dict = {}
    text = "[]"

    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def test_smoke_end_to_end_demo_with_mocked_prices(monkeypatch):
    # --- mock the Trading 212 DEMO HTTP layer (two open positions) ---
    positions = [
        {"ticker": "AAPL_US_EQ", "quantity": 5, "averagePrice": 150.0},
        {"ticker": "MSFT_US_EQ", "quantity": 3, "averagePrice": 300.0},
    ]
    seen_urls: list[str] = []

    def fake_get(self, url, headers=None, timeout=None):
        seen_urls.append(url)
        return _FakeResp(positions)

    monkeypatch.setattr(requests.Session, "get", fake_get)

    # --- mock price data ---
    provider = _FakeProvider(_golden_cross_series())
    monkeypatch.setattr("app.pipeline.get_price_provider", lambda *a, **k: provider)

    cfg = Config(t212_api_key="demo-key", anthropic_api_key=None, signal_threshold=0.3)
    assert cfg.is_demo  # default base URL is the demo environment

    reports = run_pipeline(config=cfg, use_cache=False, write=False)

    # Portfolio came from the demo portfolio endpoint; both tickers were priced.
    assert any(u.endswith("/equity/portfolio") for u in seen_urls)
    assert set(provider.requested) == {"AAPL", "MSFT"}

    # Both symbols produced an above-threshold golden-cross signal + a rationale.
    assert {r.signal.symbol for r in reports} == {"AAPL", "MSFT"}
    assert all(
        "golden_cross_momentum" in r.signal.triggered_rule_names for r in reports
    )
    assert all(r.rationale for r in reports)  # deterministic fallback narration

    # The digest renders with the required fields (rules, stop, key levels).
    md = render_markdown_digest(reports)
    assert "Swing Signal Digest" in md
    assert "AAPL" in md and "MSFT" in md
    assert "Stop context" in md


def test_pipeline_is_resilient_to_one_bad_symbol(monkeypatch):
    good = _golden_cross_series()

    class _Provider(PriceProvider):
        name = "mixed"

        def get_history(self, symbol, lookback_days=400):
            if symbol == "BAD":
                raise RuntimeError("boom")  # one symbol blows up
            return make_ohlcv(good)

    monkeypatch.setattr("app.pipeline.get_price_provider", lambda *a, **k: _Provider())

    cfg = Config(anthropic_api_key=None, signal_threshold=0.3)
    reports = run_pipeline(
        config=cfg, symbols=["BAD", "GOOD"], use_cache=False, write=False
    )
    # BAD was logged and skipped; GOOD still produced a report.
    assert [r.signal.symbol for r in reports] == ["GOOD"]
