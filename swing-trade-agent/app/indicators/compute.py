"""Technical indicator calculation via ``pandas-ta-classic``.

Single responsibility: take a raw daily OHLCV frame and return a copy with the
exact indicator columns the signals engine requires appended
(:data:`INDICATOR_COLUMNS`, which lines up with
``app.signals.REQUIRED_COLUMNS``). All maths is deterministic — no network, no
randomness, no hidden state.

Input contract
--------------
A ``pandas.DataFrame`` with lowercase columns ``open, high, low, close,
volume`` indexed by an **ascending** ``DatetimeIndex``.

Guarantees
----------
- The input is never mutated; a copy is returned.
- The row count is unchanged. Leading rows where an indicator is not yet
  defined hold ``NaN`` (they are **not** dropped) so date alignment — which the
  backtest depends on — is preserved.
- Short or empty input is handled gracefully: ``pandas-ta-classic`` returns
  ``None`` when there aren't enough rows for a window, and we coerce that to an
  all-``NaN`` column rather than raising.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pandas_ta_classic as ta

# Raw OHLCV columns expected on the input frame.
OHLCV_COLUMNS = ["open", "high", "low", "close", "volume"]

# Indicator columns appended by add_indicators. This set must stay identical to
# the indicator members of app.signals.REQUIRED_COLUMNS (everything there except
# the raw ``close``/``volume`` that already exist on the OHLCV frame).
INDICATOR_COLUMNS = [
    "rsi_14",
    "macd",
    "macd_signal",
    "macd_hist",
    "sma_20",
    "sma_50",
    "sma_200",
    "ema_20",
    "ema_50",
    "bb_lower",
    "bb_mid",
    "bb_upper",
    "atr_14",
    "vol_sma_20",
]


def _validate_ohlcv(df: pd.DataFrame) -> None:
    """Defensive input checks (mirrors the validation style of the signals engine)."""
    if not isinstance(df, pd.DataFrame):
        raise TypeError("add_indicators expects a pandas DataFrame")
    missing = [c for c in OHLCV_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"OHLCV frame missing columns: {missing}")
    if not df.index.is_monotonic_increasing:
        raise ValueError("price frame index must be sorted ascending by date")


def _series(result: pd.Series | None, index: pd.Index) -> pd.Series:
    """Coerce a pandas-ta result to a Series aligned to ``index``.

    ``pandas-ta-classic`` returns ``None`` when the input is too short for the
    window; that becomes an all-NaN column so short input never raises.
    """
    if result is None:
        return pd.Series(np.nan, index=index)
    if isinstance(result, pd.Series):
        return result.reindex(index)
    return pd.Series(np.asarray(result, dtype=float), index=index)


def _pick(frame: pd.DataFrame | None, prefix: str, index: pd.Index) -> pd.Series:
    """Select the column of a multi-output pandas-ta frame by name prefix.

    pandas-ta encodes parameters in column names (e.g. ``BBL_20_2.0``,
    ``MACDs_12_26_9``); we match on the stable prefix so a formatting change in
    the numeric suffix can't silently misalign a column. Returns NaN if the
    frame is ``None`` (short input) or the prefix is absent.
    """
    if frame is not None:
        for col in frame.columns:
            if str(col).startswith(prefix):
                return frame[col].reindex(index)
    return pd.Series(np.nan, index=index)


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of ``df`` with :data:`INDICATOR_COLUMNS` appended.

    Parameters
    ----------
    df:
        Raw OHLCV frame (``open, high, low, close, volume``), ascending
        DatetimeIndex.

    Returns
    -------
    pandas.DataFrame
        A new frame — the input is not mutated — with every required indicator
        column added. Warmup rows hold ``NaN``; the row count is unchanged.
    """
    _validate_ohlcv(df)

    out = df.copy()
    index = out.index
    close = out["close"].astype(float)
    high = out["high"].astype(float)
    low = out["low"].astype(float)
    volume = out["volume"].astype(float)

    # Momentum
    out["rsi_14"] = _series(ta.rsi(close, length=14), index)

    # MACD (12, 26, 9): line / signal / histogram
    macd = ta.macd(close, fast=12, slow=26, signal=9)
    out["macd"] = _pick(macd, "MACD_", index)
    out["macd_signal"] = _pick(macd, "MACDs", index)
    out["macd_hist"] = _pick(macd, "MACDh", index)

    # Simple moving averages
    out["sma_20"] = _series(ta.sma(close, length=20), index)
    out["sma_50"] = _series(ta.sma(close, length=50), index)
    out["sma_200"] = _series(ta.sma(close, length=200), index)

    # Exponential moving averages
    out["ema_20"] = _series(ta.ema(close, length=20), index)
    out["ema_50"] = _series(ta.ema(close, length=50), index)

    # Bollinger Bands (20, 2): lower / mid / upper
    bbands = ta.bbands(close, length=20, std=2.0)
    out["bb_lower"] = _pick(bbands, "BBL", index)
    out["bb_mid"] = _pick(bbands, "BBM", index)
    out["bb_upper"] = _pick(bbands, "BBU", index)

    # Volatility
    out["atr_14"] = _series(ta.atr(high, low, close, length=14), index)

    # Volume
    out["vol_sma_20"] = _series(ta.sma(volume, length=20), index)

    return out


# Backward-compatible alias: earlier modules import ``compute_indicators``.
compute_indicators = add_indicators
