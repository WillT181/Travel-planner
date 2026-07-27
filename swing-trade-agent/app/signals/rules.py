"""Swing-setup rules.

Each rule is a pure function of an *indicator* DataFrame (as produced by
:func:`app.indicators.compute_indicators`). A rule evaluates the setup at the
**last row** of the frame, using earlier rows only for crossover context. This
design lets the backtest replay a rule at any point by slicing the frame to
``df.iloc[: i + 1]``.

Every rule returns a :class:`RuleResult` with a boolean and a 0-1 strength.
Rules are long-only swing setups for now; ``direction`` is inferred by the
engine.
"""

from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

from app.signals.models import RuleResult

# A rule takes the indicator frame and returns a RuleResult.
Rule = Callable[[pd.DataFrame], RuleResult]


def _clamp01(x: float) -> float:
    if x is None or np.isnan(x):
        return 0.0
    return float(min(1.0, max(0.0, x)))


def _has_rows(df: pd.DataFrame, n: int) -> bool:
    return df is not None and len(df) >= n


def _val(row: pd.Series, col: str) -> float:
    v = row.get(col, np.nan)
    return float(v) if v is not None else np.nan


def _finite(*values: float) -> bool:
    return all(v is not None and np.isfinite(v) for v in values)


def oversold_bounce(df: pd.DataFrame) -> RuleResult:
    """RSI(14) crosses up through 30 while price is above the SMA200.

    A classic "buy the dip in an uptrend" setup: momentum was oversold and is
    now turning up, but the longer-term trend (price > SMA200) is still intact.
    """
    name = "oversold_bounce"
    if not _has_rows(df, 2):
        return RuleResult(name, False, 0.0, "insufficient history")

    curr, prev = df.iloc[-1], df.iloc[-2]
    rsi_now, rsi_prev = _val(curr, "rsi_14"), _val(prev, "rsi_14")
    close, sma200 = _val(curr, "close"), _val(curr, "sma_200")

    if not _finite(rsi_now, rsi_prev, close, sma200):
        return RuleResult(name, False, 0.0, "indicators not warmed up")

    crossed_up = rsi_prev < 30.0 <= rsi_now
    above_trend = close > sma200
    triggered = bool(crossed_up and above_trend)

    if not triggered:
        return RuleResult(
            name,
            False,
            0.0,
            f"rsi {rsi_prev:.1f}->{rsi_now:.1f}, close {close:.2f} vs sma200 {sma200:.2f}",
        )

    # Strength: deeper prior oversold + comfortably above the trend line.
    oversold_depth = _clamp01((30.0 - rsi_prev) / 15.0)  # full at RSI<=15
    trend_cushion = _clamp01((close / sma200 - 1.0) / 0.10)  # full at +10%
    strength = _clamp01(0.4 + 0.4 * oversold_depth + 0.2 * trend_cushion)
    return RuleResult(
        name,
        True,
        strength,
        f"RSI crossed 30 ({rsi_prev:.1f}->{rsi_now:.1f}); price {close:.2f} "
        f"is {100 * (close / sma200 - 1):.1f}% above SMA200",
    )


def golden_cross_momentum(df: pd.DataFrame) -> RuleResult:
    """SMA50 crosses above SMA200 (a golden cross)."""
    name = "golden_cross_momentum"
    if not _has_rows(df, 2):
        return RuleResult(name, False, 0.0, "insufficient history")

    curr, prev = df.iloc[-1], df.iloc[-2]
    s50_now, s200_now = _val(curr, "sma_50"), _val(curr, "sma_200")
    s50_prev, s200_prev = _val(prev, "sma_50"), _val(prev, "sma_200")

    if not _finite(s50_now, s200_now, s50_prev, s200_prev):
        return RuleResult(name, False, 0.0, "moving averages not warmed up")

    crossed = s50_prev <= s200_prev and s50_now > s200_now
    if not crossed:
        return RuleResult(name, False, 0.0, "no SMA50/SMA200 cross")

    # Strength: how decisively the fast MA is pulling above the slow MA, plus a
    # confirmation that price is participating (close above SMA50).
    separation = _clamp01((s50_now / s200_now - 1.0) / 0.02)  # full at +2%
    close = _val(curr, "close")
    confirm = 1.0 if (_finite(close) and close > s50_now) else 0.0
    strength = _clamp01(0.5 + 0.3 * separation + 0.2 * confirm)
    return RuleResult(
        name,
        True,
        strength,
        f"SMA50 {s50_now:.2f} crossed above SMA200 {s200_now:.2f}",
    )


def macd_bullish_crossover(df: pd.DataFrame) -> RuleResult:
    """MACD line crosses above its signal line, near the zero line.

    Crossovers close to zero (rather than deep in positive territory) tend to
    mark the *start* of a move rather than its middle, so proximity to zero
    increases the strength.
    """
    name = "macd_bullish_crossover"
    if not _has_rows(df, 2):
        return RuleResult(name, False, 0.0, "insufficient history")

    curr, prev = df.iloc[-1], df.iloc[-2]
    macd_now, sig_now = _val(curr, "macd"), _val(curr, "macd_signal")
    macd_prev, sig_prev = _val(prev, "macd"), _val(prev, "macd_signal")
    atr_now, close = _val(curr, "atr_14"), _val(curr, "close")

    if not _finite(macd_now, sig_now, macd_prev, sig_prev):
        return RuleResult(name, False, 0.0, "macd not warmed up")

    crossed = macd_prev <= sig_prev and macd_now > sig_now
    if not crossed:
        return RuleResult(name, False, 0.0, "no MACD/signal cross")

    # "Near zero": scale |macd| against ATR (fallback to a small fraction of
    # price) so the notion of "near" is unit-consistent across tickers.
    scale = atr_now if _finite(atr_now) and atr_now > 0 else (
        abs(close) * 0.01 if _finite(close) and close != 0 else 1.0
    )
    nearness = _clamp01(1.0 - abs(macd_now) / scale)  # 1 at zero, 0 at >=1 ATR
    strength = _clamp01(0.45 + 0.55 * nearness)
    return RuleResult(
        name,
        True,
        strength,
        f"MACD {macd_now:.3f} crossed above signal {sig_now:.3f} "
        f"(|macd|/atr={abs(macd_now) / scale:.2f})",
    )


def bollinger_mean_reversion(df: pd.DataFrame) -> RuleResult:
    """Close dipped below the lower Bollinger Band, then closed back inside.

    A short-term mean-reversion bounce: yesterday's close pierced the lower
    band; today's close is back inside the band.
    """
    name = "bollinger_mean_reversion"
    if not _has_rows(df, 2):
        return RuleResult(name, False, 0.0, "insufficient history")

    curr, prev = df.iloc[-1], df.iloc[-2]
    close_now = _val(curr, "close")
    lower_now, mid_now = _val(curr, "bb_lower"), _val(curr, "bb_mid")
    close_prev, lower_prev = _val(prev, "close"), _val(prev, "bb_lower")

    if not _finite(close_now, lower_now, mid_now, close_prev, lower_prev):
        return RuleResult(name, False, 0.0, "bands not warmed up")

    was_below = close_prev < lower_prev
    back_inside = lower_now <= close_now < mid_now
    triggered = bool(was_below and back_inside)
    if not triggered:
        return RuleResult(name, False, 0.0, "no band re-entry")

    # Strength: how far the prior close pierced below the band (normalised by
    # band width), capped.
    width = mid_now - lower_now
    pierce = (lower_prev - close_prev) / width if width > 0 else 0.0
    strength = _clamp01(0.5 + 0.5 * _clamp01(pierce))
    return RuleResult(
        name,
        True,
        strength,
        f"prev close {close_prev:.2f} < lower band {lower_prev:.2f}; "
        f"now {close_now:.2f} back inside",
    )


# Registry consumed by the engine and the backtest. Order is stable.
RULES: list[Rule] = [
    oversold_bounce,
    golden_cross_momentum,
    macd_bullish_crossover,
    bollinger_mean_reversion,
]

RULES_BY_NAME: dict[str, Rule] = {r.__name__: r for r in RULES}
