"""Tests for the backtest harness.

Covers the forward-return math (with a controlled synthetic rule) and the
end-to-end aggregation across the real rule registry.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.backtest import backtest_rules, backtest_symbol, summarize
from app.backtest.harness import RuleStats
from app.signals.models import RuleResult
from tests.conftest import make_ohlcv


def _always_on_at(bar_index: int):
    """A synthetic rule that triggers only when the window ends at bar_index."""

    def rule(df):
        return RuleResult("probe", triggered=(len(df) - 1 == bar_index), strength=1.0)

    rule.__name__ = "probe"
    return rule


def test_forward_return_math_is_exact():
    # Deterministic closes: known ratio between bar i and bar i+horizon.
    closes = np.linspace(100.0, 359.0, 260)  # strictly increasing
    df = make_ohlcv(closes)
    horizon = 10
    target = 205  # a bar comfortably past SMA200 warmup and before the tail
    rule = _always_on_at(target)

    stats = backtest_symbol(df, horizon=horizon, rules=[rule])
    st = stats["probe"]
    assert st.signals == 1
    expected = closes[target + horizon] / closes[target] - 1.0
    assert st.forward_returns[0] == pytest.approx(expected)
    assert st.wins == 1  # rising series -> positive forward return
    assert st.hit_rate == 1.0
    assert st.avg_return == pytest.approx(expected)


def test_backtest_respects_warmup_and_horizon_bounds():
    closes = np.linspace(100.0, 200.0, 260)
    df = make_ohlcv(closes)
    horizon = 5
    # Rule that would trigger on EVERY bar; count how many samples we get.
    rule = lambda df: RuleResult("all", True, 1.0)  # noqa: E731
    rule.__name__ = "all"
    stats = backtest_symbol(df, horizon=horizon, rules=[rule])
    st = stats["all"]
    # Samples only from first SMA200-valid bar (index 199) to n-horizon-1.
    n = len(df)
    expected_samples = (n - horizon) - 199
    assert st.signals == expected_samples
    assert st.signals > 0


def test_backtest_rules_end_to_end_over_registry():
    # Two synthetic symbols; just assert it runs and produces stats for every
    # rule with sane fields.
    rng = np.random.default_rng(11)
    data = {
        "AAA": make_ohlcv(100 + np.cumsum(rng.normal(0.1, 1.0, 300))),
        "BBB": make_ohlcv(120 + np.cumsum(rng.normal(-0.05, 1.2, 300))),
    }
    result = backtest_rules(data, horizon=10)
    assert result.symbols == ["AAA", "BBB"]
    assert set(result.stats.keys()) == {
        "oversold_bounce",
        "golden_cross_momentum",
        "macd_bullish_crossover",
        "bollinger_mean_reversion",
        "ema_pullback_resume",
    }
    for st in result.stats.values():
        assert isinstance(st, RuleStats)
        assert st.signals >= 0
        assert 0.0 <= st.hit_rate <= 1.0
    # Summary renders without error and mentions the horizon.
    text = summarize(result)
    assert "horizon 10" in text


def test_backtest_frame_columns():
    closes = np.linspace(100.0, 200.0, 260)
    result = backtest_rules({"AAA": make_ohlcv(closes)}, horizon=10)
    frame = result.to_frame()
    assert set(["rule", "signals", "hit_rate", "avg_return", "median_return"]).issubset(
        frame.columns
    )
