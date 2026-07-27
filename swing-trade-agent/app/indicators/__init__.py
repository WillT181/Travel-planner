"""Deterministic technical indicators (via pandas-ta-classic).

`add_indicators(df)` takes a raw OHLCV frame and returns a copy with the
indicator columns the signals engine requires appended. Every value is computed
by `pandas-ta-classic` — deterministic maths, no LLM, no network. That "no LLM
in indicator/signal math" rule is a hard project invariant (see CLAUDE.md).
"""

from app.indicators.compute import (
    INDICATOR_COLUMNS,
    OHLCV_COLUMNS,
    add_indicators,
    compute_indicators,
)

__all__ = [
    "INDICATOR_COLUMNS",
    "OHLCV_COLUMNS",
    "add_indicators",
    "compute_indicators",
]
