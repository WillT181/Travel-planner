"""Replay signal rules over historical data and measure forward returns.

For each bar where a rule fires, we record the forward return N trading days
later (``close[i+N] / close[i] - 1``). Aggregated per rule this gives a
hit-rate and average forward return so you can validate a rule BEFORE trusting
it — which is the whole point of building the backtest early.

Nothing here is a trade recommendation. Forward returns are measured from the
close of the signal bar with no slippage/costs; treat them as a research
signal, not a P&L promise.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from statistics import mean, median

import numpy as np
import pandas as pd

from app.indicators import add_indicators
from app.signals.rules import RULES, Rule


@dataclass
class RuleStats:
    """Aggregated forward-return statistics for one rule."""

    rule: str
    horizon: int
    signals: int = 0
    wins: int = 0
    forward_returns: list[float] = field(default_factory=list)

    @property
    def hit_rate(self) -> float:
        return self.wins / self.signals if self.signals else 0.0

    @property
    def avg_return(self) -> float:
        return float(mean(self.forward_returns)) if self.forward_returns else 0.0

    @property
    def median_return(self) -> float:
        return float(median(self.forward_returns)) if self.forward_returns else 0.0

    def to_dict(self) -> dict:
        return {
            "rule": self.rule,
            "horizon": self.horizon,
            "signals": self.signals,
            "hit_rate": round(self.hit_rate, 4),
            "avg_return": round(self.avg_return, 5),
            "median_return": round(self.median_return, 5),
        }


@dataclass
class BacktestResult:
    """Full backtest output keyed by rule name."""

    horizon: int
    symbols: list[str]
    stats: dict[str, RuleStats]

    def as_rows(self) -> list[dict]:
        return [self.stats[name].to_dict() for name in self.stats]

    def to_frame(self) -> pd.DataFrame:
        return pd.DataFrame(self.as_rows())


def _warmup_index(indicator_df: pd.DataFrame) -> int:
    """First row index at which the slowest indicator (SMA200) is defined."""
    valid = indicator_df["sma_200"].notna()
    if not valid.any():
        return len(indicator_df)  # never warmed up
    return int(np.argmax(valid.to_numpy()))


def backtest_symbol(
    ohlcv: pd.DataFrame,
    horizon: int = 10,
    rules: list[Rule] | None = None,
    stats: dict[str, RuleStats] | None = None,
) -> dict[str, RuleStats]:
    """Backtest all rules for a single symbol, accumulating into ``stats``.

    Parameters
    ----------
    ohlcv:
        Raw OHLCV frame (indicators are computed internally).
    horizon:
        Forward-return window in trading days.
    rules:
        Rules to test (defaults to the full registry).
    stats:
        Optional accumulator so multiple symbols roll into shared totals.
    """
    rules = rules or RULES
    if stats is None:
        stats = {r.__name__: RuleStats(rule=r.__name__, horizon=horizon) for r in rules}

    indicators = add_indicators(ohlcv)
    closes = indicators["close"].to_numpy(dtype=float)
    n = len(indicators)
    start = _warmup_index(indicators)

    # Evaluate at each bar from warmup up to the last bar that still has a
    # full forward window available.
    for i in range(max(start, 1), n - horizon):
        window = indicators.iloc[: i + 1]
        entry = closes[i]
        if not np.isfinite(entry) or entry == 0:
            continue
        fwd_ret = closes[i + horizon] / entry - 1.0
        if not np.isfinite(fwd_ret):
            continue

        for rule in rules:
            result = rule(window)
            if result.triggered:
                st = stats[rule.__name__]
                st.signals += 1
                st.forward_returns.append(fwd_ret)
                if fwd_ret > 0:
                    st.wins += 1

    return stats


def backtest_rules(
    price_data: dict[str, pd.DataFrame],
    horizon: int = 10,
    rules: list[Rule] | None = None,
) -> BacktestResult:
    """Backtest across many symbols.

    Parameters
    ----------
    price_data:
        Mapping of ``symbol -> OHLCV DataFrame``.
    horizon:
        Forward-return window in trading days.
    """
    rules = rules or RULES
    stats = {r.__name__: RuleStats(rule=r.__name__, horizon=horizon) for r in rules}
    for _symbol, ohlcv in price_data.items():
        backtest_symbol(ohlcv, horizon=horizon, rules=rules, stats=stats)
    return BacktestResult(
        horizon=horizon, symbols=sorted(price_data.keys()), stats=stats
    )


def summarize(result: BacktestResult) -> str:
    """Render a compact text table of the backtest results."""
    lines = [
        f"Backtest — horizon {result.horizon} trading days, "
        f"{len(result.symbols)} symbol(s)",
        f"{'rule':<26}{'signals':>9}{'hit_rate':>10}{'avg_ret':>10}{'median':>10}",
        "-" * 65,
    ]
    for row in result.as_rows():
        lines.append(
            f"{row['rule']:<26}{row['signals']:>9}"
            f"{row['hit_rate'] * 100:>9.1f}%"
            f"{row['avg_return'] * 100:>9.2f}%"
            f"{row['median_return'] * 100:>9.2f}%"
        )
    return "\n".join(lines)
