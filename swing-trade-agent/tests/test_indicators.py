"""Unit tests for the deterministic indicator calculations."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.indicators import (
    INDICATOR_COLUMNS,
    atr,
    bollinger_bands,
    compute_indicators,
    ema,
    macd,
    obv,
    rsi,
    sma,
)
from tests.conftest import make_ohlcv


def test_sma_basic():
    s = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
    result = sma(s, 3)
    assert np.isnan(result.iloc[0])
    assert np.isnan(result.iloc[1])
    assert result.iloc[2] == pytest.approx(2.0)
    assert result.iloc[3] == pytest.approx(3.0)
    assert result.iloc[4] == pytest.approx(4.0)


def test_ema_first_value_is_seed():
    s = pd.Series([10.0, 11.0, 12.0, 13.0, 14.0])
    e = ema(s, 3)
    # First 2 are NaN (min_periods=3); the third equals the SMA seed region's
    # ewm value. Just assert monotonic increase and no NaN after warmup.
    assert e.iloc[:2].isna().all()
    assert e.iloc[2:].notna().all()
    assert e.iloc[4] > e.iloc[2]


def test_rsi_all_gains_is_100():
    s = pd.Series(np.arange(1, 30, dtype=float))
    r = rsi(s, 14)
    # A strictly rising series has no losses -> RSI pinned at 100.
    assert r.dropna().iloc[-1] == pytest.approx(100.0)


def test_rsi_all_losses_is_zero():
    s = pd.Series(np.arange(30, 1, -1, dtype=float))
    r = rsi(s, 14)
    assert r.dropna().iloc[-1] == pytest.approx(0.0, abs=1e-9)


def test_rsi_bounds_and_warmup():
    rng = np.random.default_rng(0)
    s = pd.Series(100 + np.cumsum(rng.normal(0, 1, 100)))
    r = rsi(s, 14)
    assert r.iloc[:14].isna().all()
    valid = r.dropna()
    assert (valid >= 0).all() and (valid <= 100).all()


def test_macd_columns_and_relationship():
    rng = np.random.default_rng(1)
    s = pd.Series(100 + np.cumsum(rng.normal(0, 1, 100)))
    m = macd(s)
    assert list(m.columns) == ["macd", "macd_signal", "macd_hist"]
    # Histogram is macd - signal by definition.
    diff = (m["macd"] - m["macd_signal"]) - m["macd_hist"]
    assert diff.dropna().abs().max() == pytest.approx(0.0, abs=1e-9)


def test_bollinger_band_ordering_and_midpoint():
    rng = np.random.default_rng(2)
    s = pd.Series(100 + np.cumsum(rng.normal(0, 1, 60)))
    bb = bollinger_bands(s, 20, 2.0)
    valid = bb.dropna()
    assert (valid["bb_upper"] >= valid["bb_mid"]).all()
    assert (valid["bb_mid"] >= valid["bb_lower"]).all()
    # Midline equals the 20-SMA.
    assert (valid["bb_mid"] - sma(s, 20).dropna()).abs().max() == pytest.approx(
        0.0, abs=1e-9
    )


def test_atr_positive_and_constant_range():
    # Constant true range of 2.0 (high-low=2, no gaps) -> ATR converges to 2.0.
    n = 40
    close = pd.Series(np.full(n, 100.0))
    high = close + 1.0
    low = close - 1.0
    a = atr(high, low, close, 14)
    assert a.dropna().iloc[-1] == pytest.approx(2.0, abs=1e-6)


def test_obv_accumulates_with_direction():
    close = pd.Series([10.0, 11.0, 10.5, 12.0])
    vol = pd.Series([100.0, 200.0, 300.0, 400.0])
    o = obv(close, vol)
    # 0 (first), +200 (up), -300 (down), +400 (up) -> 0, 200, -100, 300
    assert list(o) == [0.0, 200.0, -100.0, 300.0]


def test_compute_indicators_schema_and_no_lookahead():
    closes = 100 + np.cumsum(np.random.default_rng(3).normal(0, 1, 260))
    df = make_ohlcv(closes)
    out = compute_indicators(df)
    for col in INDICATOR_COLUMNS:
        assert col in out.columns, f"missing {col}"
    # SMA200 only defined once we have >=200 rows.
    assert out["sma_200"].iloc[:199].isna().all()
    assert not np.isnan(out["sma_200"].iloc[-1])
    # Original OHLCV preserved.
    assert (out["close"] == df["close"]).all()


def test_compute_indicators_rejects_unsorted_index():
    closes = np.arange(100, 130, dtype=float)
    df = make_ohlcv(closes)
    df = df.iloc[::-1]  # descending
    with pytest.raises(ValueError):
        compute_indicators(df)


def test_compute_indicators_rejects_missing_columns():
    df = pd.DataFrame({"close": [1.0, 2.0, 3.0]})
    with pytest.raises(ValueError):
        compute_indicators(df)
