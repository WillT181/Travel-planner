"""Indicator calculations.

Input DataFrames use lowercase OHLCV column names: ``open, high, low, close,
volume`` indexed by date (ascending). Functions return pandas Series aligned to
the input index; ``compute_indicators`` returns a copy of the frame with all
indicator columns appended.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Columns added by compute_indicators (useful for tests / schema checks).
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
    "bb_mid",
    "bb_upper",
    "bb_lower",
    "atr_14",
    "obv",
    "vol_sma_20",
]

OHLCV_COLUMNS = ["open", "high", "low", "close", "volume"]


def _as_series(data: pd.Series | pd.DataFrame, column: str) -> pd.Series:
    if isinstance(data, pd.DataFrame):
        return data[column].astype(float)
    return data.astype(float)


def sma(close: pd.Series, length: int) -> pd.Series:
    """Simple moving average."""
    return close.astype(float).rolling(window=length, min_periods=length).mean()


def ema(close: pd.Series, length: int) -> pd.Series:
    """Exponential moving average (adjust=False, standard TA convention)."""
    return close.astype(float).ewm(span=length, adjust=False, min_periods=length).mean()


def rsi(close: pd.Series, length: int = 14) -> pd.Series:
    """Wilder's Relative Strength Index.

    Uses Wilder smoothing (equivalent to an EMA with alpha = 1/length). Returns
    values in the 0-100 range; the first ``length`` entries are NaN.
    """
    close = close.astype(float)
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)

    # Wilder's smoothing via ewm(alpha=1/length). min_periods ensures we only
    # emit values once we have a full seed window.
    avg_gain = gain.ewm(alpha=1 / length, min_periods=length, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / length, min_periods=length, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi_series = 100.0 - (100.0 / (1.0 + rs))
    # When avg_loss is 0 the market only went up -> RSI 100.
    rsi_series = rsi_series.where(avg_loss != 0, 100.0)
    # Preserve NaN during the warmup window.
    rsi_series[avg_gain.isna()] = np.nan
    return rsi_series.rename("rsi_14" if length == 14 else f"rsi_{length}")


def macd(
    close: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> pd.DataFrame:
    """Moving Average Convergence Divergence.

    Returns a DataFrame with columns ``macd``, ``macd_signal``, ``macd_hist``.
    """
    close = close.astype(float)
    ema_fast = close.ewm(span=fast, adjust=False, min_periods=fast).mean()
    ema_slow = close.ewm(span=slow, adjust=False, min_periods=slow).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    hist = macd_line - signal_line
    return pd.DataFrame(
        {"macd": macd_line, "macd_signal": signal_line, "macd_hist": hist}
    )


def bollinger_bands(
    close: pd.Series, length: int = 20, num_std: float = 2.0
) -> pd.DataFrame:
    """Bollinger Bands.

    Returns columns ``bb_mid``, ``bb_upper``, ``bb_lower``. Uses a population
    standard deviation (ddof=0), the standard convention for Bollinger Bands.
    """
    close = close.astype(float)
    mid = close.rolling(window=length, min_periods=length).mean()
    std = close.rolling(window=length, min_periods=length).std(ddof=0)
    upper = mid + num_std * std
    lower = mid - num_std * std
    return pd.DataFrame({"bb_mid": mid, "bb_upper": upper, "bb_lower": lower})


def atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    length: int = 14,
) -> pd.Series:
    """Average True Range (Wilder smoothing)."""
    high = high.astype(float)
    low = low.astype(float)
    close = close.astype(float)
    prev_close = close.shift(1)

    true_range = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)

    atr_series = true_range.ewm(alpha=1 / length, min_periods=length, adjust=False).mean()
    return atr_series.rename("atr_14" if length == 14 else f"atr_{length}")


def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    """On-Balance Volume.

    OBV starts at 0 and adds volume on up-closes, subtracts on down-closes.
    """
    close = close.astype(float)
    volume = volume.astype(float)
    direction = np.sign(close.diff()).fillna(0.0)
    obv_series = (direction * volume).cumsum()
    return obv_series.rename("obv")


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Append the full indicator set to an OHLCV frame.

    Parameters
    ----------
    df:
        DataFrame with columns ``open, high, low, close, volume`` indexed by an
        ascending DatetimeIndex.

    Returns
    -------
    A copy of ``df`` with the columns in :data:`INDICATOR_COLUMNS` appended.
    """
    missing = [c for c in OHLCV_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"OHLCV frame missing columns: {missing}")
    if not df.index.is_monotonic_increasing:
        raise ValueError("Price frame index must be sorted ascending by date")

    out = df.copy()
    close = _as_series(df, "close")
    high = _as_series(df, "high")
    low = _as_series(df, "low")
    volume = _as_series(df, "volume")

    out["rsi_14"] = rsi(close, 14)

    macd_df = macd(close, 12, 26, 9)
    out["macd"] = macd_df["macd"]
    out["macd_signal"] = macd_df["macd_signal"]
    out["macd_hist"] = macd_df["macd_hist"]

    out["sma_20"] = sma(close, 20)
    out["sma_50"] = sma(close, 50)
    out["sma_200"] = sma(close, 200)
    out["ema_20"] = ema(close, 20)
    out["ema_50"] = ema(close, 50)

    bb = bollinger_bands(close, 20, 2.0)
    out["bb_mid"] = bb["bb_mid"]
    out["bb_upper"] = bb["bb_upper"]
    out["bb_lower"] = bb["bb_lower"]

    out["atr_14"] = atr(high, low, close, 14)
    out["obv"] = obv(close, volume)
    out["vol_sma_20"] = sma(volume, 20)

    return out
