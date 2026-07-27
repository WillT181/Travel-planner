"""Shared pytest fixtures and synthetic price-series helpers.

Synthetic series are fully deterministic so every rule/indicator assertion is
reproducible without any network access.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest


def make_ohlcv(closes, *, volume=None, high_pad=0.5, low_pad=0.5, start="2023-01-02"):
    """Build an OHLCV frame from a close series.

    open = previous close (first bar opens at its own close), high/low are the
    close padded by a fixed amount so ATR/Bollinger have sane inputs.
    """
    closes = np.asarray(closes, dtype=float)
    n = len(closes)
    idx = pd.bdate_range(start=start, periods=n)
    opens = np.empty(n)
    opens[0] = closes[0]
    opens[1:] = closes[:-1]
    highs = np.maximum(opens, closes) + high_pad
    lows = np.minimum(opens, closes) - low_pad
    if volume is None:
        volume = np.full(n, 1_000_000.0)
    return pd.DataFrame(
        {
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": np.asarray(volume, dtype=float),
        },
        index=idx,
    )


def indicator_frame(rows: list[dict], start="2023-01-02") -> pd.DataFrame:
    """Build a small frame of pre-set indicator values for targeted rule tests."""
    idx = pd.bdate_range(start=start, periods=len(rows))
    return pd.DataFrame(rows, index=idx)


@pytest.fixture
def make_ohlcv_fixture():
    return make_ohlcv


@pytest.fixture
def uptrend_closes():
    """A long, mostly-rising series with a dip, enough to warm up SMA200."""
    rng = np.random.default_rng(42)
    n = 320
    trend = np.linspace(100.0, 200.0, n)
    noise = rng.normal(0.0, 1.0, n)
    dip = np.zeros(n)
    dip[150:160] = np.linspace(0, -20, 10)  # a sharp oversold dip mid-series
    dip[160:170] = np.linspace(-20, 0, 10)
    return trend + noise + dip
