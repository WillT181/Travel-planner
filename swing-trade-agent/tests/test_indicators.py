"""Unit tests for the pandas-ta-classic indicators module.

Verifies the contract add_indicators promises: every required column is
appended, the row count is unchanged, the input is not mutated, warmup rows
stay NaN, and a few hand-checkable numbers are correct.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.indicators import INDICATOR_COLUMNS, add_indicators, compute_indicators
from app.signals import REQUIRED_COLUMNS
from tests.conftest import make_ohlcv


def _ramp_ohlcv(values, *, high=None, low=None, volume=None):
    """Build an OHLCV frame directly from explicit close values."""
    closes = np.asarray(values, dtype=float)
    n = len(closes)
    idx = pd.bdate_range("2023-01-02", periods=n)
    return pd.DataFrame(
        {
            "open": closes,
            "high": closes + 1.0 if high is None else high,
            "low": closes - 1.0 if low is None else low,
            "close": closes,
            "volume": np.full(n, 1_000_000.0) if volume is None else volume,
        },
        index=idx,
    )


# --- contract --------------------------------------------------------------


def test_appends_exactly_the_required_indicator_columns():
    df = make_ohlcv(100 + np.cumsum(np.random.default_rng(0).normal(0, 1, 260)))
    out = add_indicators(df)
    added = set(out.columns) - set(df.columns)
    assert added == set(INDICATOR_COLUMNS)


def test_output_covers_signals_required_columns():
    df = make_ohlcv(100 + np.cumsum(np.random.default_rng(1).normal(0, 1, 260)))
    out = add_indicators(df)
    # Everything app.signals.build_signal validates must be present.
    assert REQUIRED_COLUMNS.issubset(set(out.columns))


def test_row_count_unchanged():
    df = make_ohlcv(np.linspace(100, 200, 250))
    out = add_indicators(df)
    assert len(out) == len(df) == 250
    assert out.index.equals(df.index)


def test_input_is_not_mutated():
    df = make_ohlcv(np.linspace(50, 150, 220))
    before = df.copy(deep=True)
    out = add_indicators(df)
    # Original frame untouched: same content and same (OHLCV-only) columns.
    pd.testing.assert_frame_equal(df, before)
    assert list(df.columns) == ["open", "high", "low", "close", "volume"]
    assert out is not df


def test_leading_warmup_rows_are_nan_not_dropped():
    df = make_ohlcv(np.linspace(100, 300, 260))
    out = add_indicators(df)
    # SMA200 needs 200 rows: first 199 NaN, defined from row 200 on.
    assert out["sma_200"].iloc[:199].isna().all()
    assert not np.isnan(out["sma_200"].iloc[199])
    # Rows are preserved, not dropped, so alignment with the input holds.
    assert len(out) == len(df)


def test_deterministic_repeatable():
    df = make_ohlcv(np.linspace(100, 180, 240))
    a = add_indicators(df)
    b = add_indicators(df)
    pd.testing.assert_frame_equal(a, b)


def test_compute_indicators_alias_is_add_indicators():
    assert compute_indicators is add_indicators


# --- hand-checkable values -------------------------------------------------


def test_sma20_matches_hand_computed_average():
    # Closes 1..40. The 20-period SMA on the last bar is the mean of 21..40.
    df = _ramp_ohlcv(np.arange(1, 41, dtype=float))
    out = add_indicators(df)
    # mean(21..40) = (21 + 40) / 2 = 30.5
    assert out["sma_20"].iloc[-1] == pytest.approx(30.5)
    # mean(1..20) = 10.5 at the first fully-formed window (index 19)
    assert out["sma_20"].iloc[19] == pytest.approx(10.5)
    # And the first 19 rows are NaN (window not yet full).
    assert out["sma_20"].iloc[:19].isna().all()


def test_sma20_matches_pandas_rolling_mean():
    closes = 100 + np.cumsum(np.random.default_rng(3).normal(0, 1, 120))
    df = make_ohlcv(closes)
    out = add_indicators(df)
    expected = df["close"].rolling(window=20, min_periods=20).mean()
    pd.testing.assert_series_equal(
        out["sma_20"], expected, check_names=False
    )


def test_sma_constant_series_equals_constant():
    df = _ramp_ohlcv(np.full(60, 100.0))
    out = add_indicators(df)
    assert out["sma_20"].iloc[-1] == pytest.approx(100.0)
    assert out["sma_50"].iloc[-1] == pytest.approx(100.0)
    assert out["ema_20"].iloc[-1] == pytest.approx(100.0)


def test_rsi_all_gains_is_100():
    df = _ramp_ohlcv(np.arange(1, 60, dtype=float))  # strictly rising
    out = add_indicators(df)
    assert out["rsi_14"].dropna().iloc[-1] == pytest.approx(100.0)


def test_atr_constant_true_range():
    # Ramp of +1/bar with high=close+1, low=close-1 => true range is a constant
    # 2.0, so Wilder ATR converges to 2.0.
    df = _ramp_ohlcv(np.arange(1, 60, dtype=float))
    out = add_indicators(df)
    assert out["atr_14"].dropna().iloc[-1] == pytest.approx(2.0, abs=1e-6)


def test_vol_sma_of_constant_volume():
    df = _ramp_ohlcv(np.arange(1, 40, dtype=float), volume=np.full(39, 500_000.0))
    out = add_indicators(df)
    assert out["vol_sma_20"].dropna().iloc[-1] == pytest.approx(500_000.0)


def test_macd_histogram_is_line_minus_signal():
    closes = 100 + np.cumsum(np.random.default_rng(4).normal(0, 1, 120))
    out = add_indicators(make_ohlcv(closes))
    diff = out["macd"] - out["macd_signal"] - out["macd_hist"]
    assert diff.dropna().abs().max() == pytest.approx(0.0, abs=1e-9)


def test_bollinger_band_ordering():
    closes = 100 + np.cumsum(np.random.default_rng(5).normal(0, 1, 120))
    out = add_indicators(make_ohlcv(closes))
    valid = out[["bb_lower", "bb_mid", "bb_upper"]].dropna()
    assert (valid["bb_upper"] >= valid["bb_mid"]).all()
    assert (valid["bb_mid"] >= valid["bb_lower"]).all()


# --- defensive handling ----------------------------------------------------


def test_short_input_returns_all_nan_without_error():
    df = _ramp_ohlcv(np.arange(1, 6, dtype=float))  # only 5 rows
    out = add_indicators(df)
    assert len(out) == 5
    for col in INDICATOR_COLUMNS:
        assert col in out.columns
        assert out[col].isna().all()  # nothing can be computed yet, but no crash


def test_empty_input_returns_empty_with_columns():
    df = _ramp_ohlcv(np.array([], dtype=float))
    out = add_indicators(df)
    assert len(out) == 0
    for col in INDICATOR_COLUMNS:
        assert col in out.columns


def test_missing_ohlcv_columns_raises():
    df = pd.DataFrame({"close": [1.0, 2.0, 3.0]})
    with pytest.raises(ValueError):
        add_indicators(df)


def test_unsorted_index_raises():
    df = make_ohlcv(np.arange(100, 130, dtype=float)).iloc[::-1]
    with pytest.raises(ValueError):
        add_indicators(df)
