"""Walk-forward backtest harness — trust-critical, no lookahead.

The one job of this module is to answer, honestly: "when a rule fired in the
past, what happened next?" — without ever letting the evaluation at bar *i* see
data from bar *i+1* onward. Lookahead bias is the failure mode that makes
backtests lie, so the loop is structured so future data is *physically
inaccessible* at evaluation time: indicators are computed once over the whole
series, and each bar is evaluated on the slice ``indicators.iloc[: i + 1]`` — a
prefix that literally contains no future rows. ``tests/test_backtest.py`` proves
this (a lookahead regression would fail those tests).

For every bar where a rule triggers we record the forward return of ``close``
at each horizon (default +5/+10/+20 trading days), skipping triggers too close
to the end of the series to have a full forward window. Results are aggregated
per rule — trigger count, hit-rate, mean and median forward return at each
horizon — alongside a naive buy-and-hold baseline over the identical set of
entry bars, so you can see whether a rule actually beats just holding.

Nothing here is a trade recommendation; forward returns are close-to-close with
no costs or slippage.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from statistics import median

import numpy as np
import pandas as pd

from app.indicators import add_indicators
from app.signals import Signal, build_signal  # build_signal == the spec's evaluate_symbol

DEFAULT_HORIZONS = (5, 10, 20)


@dataclass(frozen=True)
class HorizonStats:
    """Forward-return statistics at one horizon."""

    horizon: int
    n: int
    hit_rate: float  # fraction of forward returns > 0
    mean_return: float
    median_return: float

    def to_dict(self) -> dict:
        return {
            "horizon": self.horizon,
            "n": self.n,
            "hit_rate": round(self.hit_rate, 4),
            "mean_return": round(self.mean_return, 5),
            "median_return": round(self.median_return, 5),
        }


@dataclass
class RuleReport:
    """Aggregated forward-return stats for one rule across horizons."""

    rule: str
    triggers: int
    horizons: dict[int, HorizonStats] = field(default_factory=dict)


@dataclass
class BacktestReport:
    """Full backtest result: per-rule stats + a buy-and-hold baseline."""

    horizons: tuple[int, ...]
    symbols: list[str]
    rules: dict[str, RuleReport]
    baseline: dict[int, HorizonStats]

    @property
    def baseline_n(self) -> int:
        if not self.baseline:
            return 0
        return next(iter(self.baseline.values())).n

    def as_rows(self) -> list[dict]:
        """Tidy rows (one per rule×horizon, plus baseline×horizon)."""
        rows: list[dict] = []
        for name, rr in self.rules.items():
            for h in self.horizons:
                s = rr.horizons[h]
                rows.append({"rule": name, "triggers": rr.triggers, **s.to_dict()})
        for h in self.horizons:
            s = self.baseline[h]
            rows.append({"rule": "buy_and_hold", "triggers": s.n, **s.to_dict()})
        return rows

    def to_frame(self) -> pd.DataFrame:
        return pd.DataFrame(self.as_rows())


def _horizon_stats(returns: list[float], horizon: int) -> HorizonStats:
    """Reduce a list of forward returns into a HorizonStats (empty -> zeros)."""
    if not returns:
        return HorizonStats(horizon, 0, 0.0, 0.0, 0.0)
    arr = np.asarray(returns, dtype=float)
    hit_rate = float(np.mean(arr > 0.0))
    return HorizonStats(
        horizon=horizon,
        n=int(arr.size),
        hit_rate=hit_rate,
        mean_return=float(arr.mean()),
        median_return=float(median(arr.tolist())),
    )


def run_backtest(
    price_data: dict[str, pd.DataFrame],
    horizons: tuple[int, ...] = DEFAULT_HORIZONS,
) -> BacktestReport:
    """Backtest every rule over ``price_data``.

    Parameters
    ----------
    price_data:
        Mapping of ``symbol -> raw OHLCV DataFrame`` (ascending date index).
    horizons:
        Forward-return windows in trading days.

    Returns
    -------
    BacktestReport
        Per-rule trigger counts and forward-return stats at each horizon, plus a
        buy-and-hold baseline over the identical set of entry bars.
    """
    horizons = tuple(sorted({int(h) for h in horizons}))
    if not horizons:
        raise ValueError("horizons must be non-empty")
    max_h = max(horizons)

    # Accumulators, keyed by rule name then horizon.
    from app.signals import RULES  # local import keeps the rule set in one place

    rule_names = [r.__name__ for r in RULES]
    triggers: dict[str, int] = {name: 0 for name in rule_names}
    rule_returns: dict[str, dict[int, list[float]]] = {
        name: {h: [] for h in horizons} for name in rule_names
    }
    baseline_returns: dict[int, list[float]] = {h: [] for h in horizons}

    for symbol in price_data:
        indicators = add_indicators(price_data[symbol])
        closes = indicators["close"].to_numpy(dtype=float)
        n = len(indicators)

        # Only bars with a FULL forward window for the largest horizon are
        # eligible entries — for both the rules and the baseline, so the
        # comparison is over identical windows. i starts at 1 because the
        # evaluator needs at least two rows (crossover context).
        for i in range(1, n - max_h):
            entry = closes[i]
            if not np.isfinite(entry) or entry == 0.0:
                continue

            fwd = {h: closes[i + h] / entry - 1.0 for h in horizons}
            if any(not np.isfinite(v) for v in fwd.values()):
                continue

            # Baseline: "what if I had bought on this eligible bar and held?"
            for h in horizons:
                baseline_returns[h].append(fwd[h])

            # Evaluate the setup on the prefix ending at bar i. The slice has no
            # future rows — that is the no-lookahead guarantee.
            window = indicators.iloc[: i + 1]
            signal: Signal = build_signal(symbol, window)
            for result in signal.triggered_rules:
                triggers[result.name] += 1
                for h in horizons:
                    rule_returns[result.name][h].append(fwd[h])

    rules_report = {
        name: RuleReport(
            rule=name,
            triggers=triggers[name],
            horizons={h: _horizon_stats(rule_returns[name][h], h) for h in horizons},
        )
        for name in rule_names
    }
    baseline = {h: _horizon_stats(baseline_returns[h], h) for h in horizons}

    return BacktestReport(
        horizons=horizons,
        symbols=sorted(price_data.keys()),
        rules=rules_report,
        baseline=baseline,
    )


def format_report(report: BacktestReport) -> str:
    """Pretty-print a BacktestReport as a fixed-width summary table."""
    hs = report.horizons
    lines = [
        f"Backtest — {len(report.symbols)} symbol(s): {', '.join(report.symbols) or '—'}",
        f"Horizons (trading days): {', '.join(map(str, hs))}",
        "(forward returns are close-to-close, no costs; decision support only)",
        "",
    ]

    header = f"{'rule':<24}{'trig':>6}"
    for h in hs:
        header += f"{'+' + str(h) + ' hit':>10}{'mean':>9}{'med':>9}"
    lines.append(header)
    lines.append("-" * len(header))

    def _row(label: str, trig: int, stats: dict[int, HorizonStats]) -> str:
        row = f"{label:<24}{trig:>6}"
        for h in hs:
            s = stats[h]
            row += f"{s.hit_rate * 100:>9.1f}%{s.mean_return * 100:>8.2f}%{s.median_return * 100:>8.2f}%"
        return row

    for name, rr in report.rules.items():
        lines.append(_row(name, rr.triggers, rr.horizons))

    lines.append("-" * len(header))
    lines.append(_row("buy_and_hold (baseline)", report.baseline_n, report.baseline))
    return "\n".join(lines)
