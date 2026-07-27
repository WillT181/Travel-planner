"""Deterministic technical indicators.

Every value here is computed with plain pandas/numpy using standard,
well-documented formulas (Wilder smoothing for RSI/ATR, etc.). No LLM is ever
involved in indicator math — that is a hard rule of this project.

`pandas-ta-classic` can be used as a cross-check (see README), but the
in-repo implementations are the source of truth so the numbers are fully
unit-tested and free of a numba build dependency.
"""

from app.indicators.compute import (
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

__all__ = [
    "INDICATOR_COLUMNS",
    "atr",
    "bollinger_bands",
    "compute_indicators",
    "ema",
    "macd",
    "obv",
    "rsi",
    "sma",
]
