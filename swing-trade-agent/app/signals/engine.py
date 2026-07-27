"""Signal aggregation engine.

Runs every rule against a symbol's indicator frame and combines the results
into a single :class:`Signal`. All numbers are computed here in Python; nothing
in this module calls an LLM.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.indicators import compute_indicators
from app.signals.models import RuleResult, Signal
from app.signals.rules import RULES

# Per-rule weights for the composite score. Trend-following setups that tend to
# have longer, more reliable follow-through are weighted a touch higher than
# short-term mean-reversion bounces. Weights are normalised at runtime, so only
# their ratios matter.
RULE_WEIGHTS: dict[str, float] = {
    "golden_cross_momentum": 1.2,
    "ema_pullback_resume": 1.1,
    "oversold_bounce": 1.1,
    "macd_bullish_crossover": 1.0,
    "bollinger_mean_reversion": 0.9,
}

# ATR multiple used to suggest a stop distance FOR CONTEXT ONLY. This is not a
# trade instruction — it just gives the reader a sense of the setup's risk.
ATR_STOP_MULTIPLE = 2.0

# Small additive reward when several independent rules confirm the same setup.
# Capped so it nudges rather than dominates the weighted-mean base score.
CONFIRMATION_STEP = 0.05
CONFIRMATION_CAP = 0.15

# Columns build_signal requires on the indicator frame. compute_indicators
# always produces these; build_signal validates so a malformed frame fails
# loudly at the aggregation boundary rather than silently scoring zero.
REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {
        "close", "volume", "rsi_14",
        "macd", "macd_signal", "macd_hist",
        "sma_20", "sma_50", "sma_200",
        "ema_20", "ema_50",
        "bb_lower", "bb_mid", "bb_upper",
        "atr_14", "vol_sma_20",
    }
)


def _validate(indicator_df: pd.DataFrame) -> None:
    missing = REQUIRED_COLUMNS - set(indicator_df.columns)
    if missing:
        raise ValueError(f"indicator frame missing required columns: {sorted(missing)}")
    if len(indicator_df) < 2:
        raise ValueError("need at least 2 rows of data to evaluate signals")


def _num(row: pd.Series, col: str) -> float | None:
    v = row.get(col, np.nan)
    if v is None:
        return None
    v = float(v)
    return None if np.isnan(v) else v


def evaluate_rules(indicator_df: pd.DataFrame) -> list[RuleResult]:
    """Run every rule against the frame; return one RuleResult per rule.

    Each rule is isolated: a rule that raises is recorded as a non-triggered
    result with an error detail rather than aborting the whole evaluation.
    """
    results: list[RuleResult] = []
    for rule in RULES:
        try:
            results.append(rule(indicator_df))
        except Exception as exc:  # noqa: BLE001 - a broken rule must not kill the run
            results.append(RuleResult(rule.__name__, False, 0.0, f"error: {exc}"))
    return results


def confirmation_bonus(n_triggered: int) -> float:
    """Additive bonus rewarding multiple independent confirmations.

    Zero for 0 or 1 triggered rules; grows by ``CONFIRMATION_STEP`` per extra
    rule up to ``CONFIRMATION_CAP``.
    """
    if n_triggered <= 1:
        return 0.0
    return min(CONFIRMATION_CAP, CONFIRMATION_STEP * (n_triggered - 1))


def composite_score(results: list[RuleResult]) -> float:
    """Weighted average strength across *triggered* rules.

    Returns 0.0 when nothing triggered. The score is a weighted mean (not a
    sum) so a single strong setup is scored on its own merits and adding rules
    to the registry never inflates scores retroactively.
    """
    triggered = [r for r in results if r.triggered]
    if not triggered:
        return 0.0
    num = sum(RULE_WEIGHTS.get(r.name, 1.0) * r.strength for r in triggered)
    den = sum(RULE_WEIGHTS.get(r.name, 1.0) for r in triggered)
    return float(num / den) if den else 0.0


def _key_levels(row: pd.Series) -> dict[str, float]:
    levels: dict[str, float] = {}
    for col in [
        "close",
        "sma_20",
        "sma_50",
        "sma_200",
        "ema_20",
        "ema_50",
        "bb_upper",
        "bb_mid",
        "bb_lower",
    ]:
        v = _num(row, col)
        if v is not None:
            levels[col] = round(v, 4)
    return levels


def build_signal(symbol: str, indicator_df: pd.DataFrame) -> Signal:
    """Aggregate all rule results for ``symbol`` into a Signal.

    Raises ``ValueError`` if ``indicator_df`` is missing required columns or has
    fewer than 2 rows.
    """
    _validate(indicator_df)
    results = evaluate_rules(indicator_df)
    triggered = [r for r in results if r.triggered]
    # Weighted-mean base score, nudged up when multiple rules agree.
    score = min(1.0, composite_score(results) + confirmation_bonus(len(triggered)))

    last = indicator_df.iloc[-1] if len(indicator_df) else pd.Series(dtype=float)
    close = _num(last, "close")
    atr_val = _num(last, "atr_14")

    suggested_stop = None
    if close is not None and atr_val is not None:
        suggested_stop = round(close - ATR_STOP_MULTIPLE * atr_val, 4)

    direction = "long" if triggered else "neutral"
    as_of = None
    if len(indicator_df):
        idx = indicator_df.index[-1]
        as_of = idx.date().isoformat() if hasattr(idx, "date") else str(idx)

    return Signal(
        symbol=symbol,
        direction=direction,
        composite_score=round(score, 4),
        triggered_rules=triggered,
        key_levels=_key_levels(last),
        suggested_stop=suggested_stop,
        atr=round(atr_val, 4) if atr_val is not None else None,
        as_of=as_of,
    )


def signal_from_ohlcv(symbol: str, ohlcv: pd.DataFrame) -> Signal:
    """Convenience: compute indicators then build the signal from raw OHLCV."""
    indicators = compute_indicators(ohlcv)
    return build_signal(symbol, indicators)
