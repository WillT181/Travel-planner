"""Tests for the price providers and cache.

The network is fully mocked: yfinance is replaced with a fake module and the
cache is tested against a counting in-memory provider. No test hits a real API.
"""

from __future__ import annotations

import datetime as dt
import sys
import types

import numpy as np
import pandas as pd
import pytest

from app.config import Config
from app.prices import (
    MIN_TRADING_DAYS,
    OHLCV_COLUMNS,
    CachedPriceProvider,
    PriceProvider,
    PriceProviderError,
    YFinanceProvider,
    get_price_provider,
    normalize_ohlcv,
)
from tests.conftest import make_ohlcv


# --- a fake yfinance module ------------------------------------------------


class _FakeTicker:
    """Records the last history() kwargs and returns a Yahoo-style frame."""

    last_kwargs: dict = {}
    mode: str = "ok"  # "ok" | "empty" | "raise"

    def __init__(self, symbol):
        self.symbol = symbol

    def history(self, **kwargs):
        _FakeTicker.last_kwargs = kwargs
        if _FakeTicker.mode == "raise":
            raise RuntimeError("yahoo exploded")
        if _FakeTicker.mode == "empty":
            return pd.DataFrame()
        idx = pd.bdate_range("2023-01-02", periods=300)
        base = np.linspace(100.0, 200.0, 300)
        # Yahoo-style: capitalised columns, extra non-OHLCV columns present.
        return pd.DataFrame(
            {
                "Open": base,
                "High": base + 1.0,
                "Low": base - 1.0,
                "Close": base,
                "Adj Close": base * 0.99,
                "Volume": np.full(300, 1_000_000.0),
                "Dividends": np.zeros(300),
                "Stock Splits": np.zeros(300),
            },
            index=idx,
        )


@pytest.fixture
def fake_yf(monkeypatch):
    _FakeTicker.mode = "ok"
    _FakeTicker.last_kwargs = {}
    module = types.SimpleNamespace(Ticker=_FakeTicker)
    monkeypatch.setitem(sys.modules, "yfinance", module)
    return _FakeTicker


# --- YFinanceProvider ------------------------------------------------------


def test_yfinance_returns_normalised_ohlcv(fake_yf):
    df = YFinanceProvider().get_history("AAPL", lookback_days=300)
    assert list(df.columns) == OHLCV_COLUMNS  # lowercase, extras dropped
    assert df.index.is_monotonic_increasing
    assert len(df) == 300
    assert df["high"].iloc[0] > df["low"].iloc[0]
    # Correct call parameters were used.
    assert fake_yf.last_kwargs["interval"] == "1d"
    assert fake_yf.last_kwargs["auto_adjust"] is False


def test_yfinance_requests_at_least_min_trading_days(fake_yf):
    # Even a tiny lookback is floored to MIN_TRADING_DAYS worth of calendar days.
    YFinanceProvider().get_history("AAPL", lookback_days=10)
    period = fake_yf.last_kwargs["period"]
    assert period.endswith("d")
    requested_days = int(period[:-1])
    assert requested_days >= MIN_TRADING_DAYS


def test_yfinance_empty_raises(fake_yf):
    _FakeTicker.mode = "empty"
    with pytest.raises(PriceProviderError):
        YFinanceProvider().get_history("AAPL")


def test_yfinance_upstream_error_raises(fake_yf):
    _FakeTicker.mode = "raise"
    with pytest.raises(PriceProviderError):
        YFinanceProvider().get_history("AAPL")


# --- normalize_ohlcv -------------------------------------------------------


def test_normalize_sorts_and_selects_columns():
    idx = pd.to_datetime(["2023-01-04", "2023-01-02", "2023-01-03"])
    raw = pd.DataFrame(
        {
            "Open": [3, 1, 2],
            "High": [3, 1, 2],
            "Low": [3, 1, 2],
            "Close": [3.0, 1.0, 2.0],
            "Volume": [30, 10, 20],
            "Junk": [9, 9, 9],
        },
        index=idx,
    )
    out = normalize_ohlcv(raw)
    assert list(out.columns) == OHLCV_COLUMNS
    assert out.index.is_monotonic_increasing
    assert out["close"].tolist() == [1.0, 2.0, 3.0]


# --- CachedPriceProvider ---------------------------------------------------


class _CountingProvider(PriceProvider):
    name = "counting"

    def __init__(self, frame):
        self.frame = frame
        self.calls = 0

    def get_history(self, symbol: str, lookback_days: int = 400):
        self.calls += 1
        return self.frame.copy()


def _frame():
    return make_ohlcv(np.linspace(100.0, 130.0, 260))


def test_cache_serves_second_call_from_parquet(tmp_path):
    inner = _CountingProvider(_frame())
    cache = CachedPriceProvider(inner, tmp_path, today=lambda: dt.date(2026, 7, 27))

    a = cache.get_history("AAPL")
    b = cache.get_history("AAPL")

    assert inner.calls == 1  # second read hit the parquet cache
    assert (tmp_path / "AAPL_2026-07-27.parquet").exists()
    assert list(b.columns) == OHLCV_COLUMNS
    assert len(b) == len(a)
    assert np.allclose(b["close"].to_numpy(), a["close"].to_numpy())


def test_cache_key_includes_date_so_new_day_refetches(tmp_path):
    inner = _CountingProvider(_frame())
    clock = {"d": dt.date(2026, 7, 27)}
    cache = CachedPriceProvider(inner, tmp_path, today=lambda: clock["d"])

    cache.get_history("AAPL")
    clock["d"] = dt.date(2026, 7, 28)  # a new day -> a new cache key
    cache.get_history("AAPL")

    assert inner.calls == 2
    assert (tmp_path / "AAPL_2026-07-27.parquet").exists()
    assert (tmp_path / "AAPL_2026-07-28.parquet").exists()


def test_corrupt_cache_file_triggers_refetch(tmp_path):
    inner = _CountingProvider(_frame())
    cache = CachedPriceProvider(inner, tmp_path, today=lambda: dt.date(2026, 7, 27))
    path = tmp_path / "AAPL_2026-07-27.parquet"
    tmp_path.mkdir(exist_ok=True)
    path.write_text("not a parquet file")

    df = cache.get_history("AAPL")  # unreadable cache -> refetch, don't crash
    assert inner.calls == 1
    assert len(df) == 260
    # The bad file was overwritten with a valid parquet.
    assert len(pd.read_parquet(path)) == 260


# --- factory ---------------------------------------------------------------


def test_factory_wraps_yfinance_in_cache():
    p = get_price_provider(Config(price_provider="yfinance"))
    assert isinstance(p, CachedPriceProvider)
    assert isinstance(p.inner, YFinanceProvider)


def test_factory_no_cache_returns_bare_provider():
    p = get_price_provider(Config(price_provider="yfinance"), use_cache=False)
    assert isinstance(p, YFinanceProvider)


def test_factory_unknown_provider_raises():
    with pytest.raises(ValueError):
        get_price_provider(Config(price_provider="bloomberg"))
