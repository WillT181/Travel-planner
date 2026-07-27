"""Tests for the walk-forward backtest harness.

Two things matter most here and get the most scrutiny:

1. The forward-return maths is exactly right (engineered series with a known
   outcome).
2. There is no lookahead — the evaluation at bar i cannot see bar i+1. Two
   independent tests would fail if lookahead were introduced: one asserts the
   evaluator only ever receives growing prefixes, the other scrambles the
   future and checks that earlier trigger decisions are unchanged.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.backtest import BacktestReport, format_report, run_backtest
from app.signals import RULES
from app.signals.models import RuleResult
from tests.conftest import make_ohlcv

RULE_NAMES = {r.__name__ for r in RULES}


def _patch_rules(monkeypatch, rules):
    """Point both the harness's rule list and the engine's at a custom set."""
    names = [r.__name__ for r in rules]
    monkeypatch.setattr("app.signals.RULES", rules)
    monkeypatch.setattr("app.signals.engine.RULES", rules)
    return names


def _probe(trigger_at):
    """A synthetic rule that triggers only when the window ends at trigger_at."""

    def probe(df):
        return RuleResult("probe", triggered=(len(df) - 1 == trigger_at), strength=1.0)

    probe.__name__ = "probe"
    return probe


# --- forward-return maths --------------------------------------------------


def test_forward_return_math_is_exact(monkeypatch):
    closes = np.linspace(100.0, 200.0, 260)
    df = make_ohlcv(closes)
    target = 205  # has a full +20 window (225 < 260) and is past warmup
    _patch_rules(monkeypatch, [_probe(target)])

    report = run_backtest({"X": df}, horizons=(5, 10, 20))
    probe = report.rules["probe"]
    assert probe.triggers == 1
    for h in (5, 10, 20):
        s = probe.horizons[h]
        expected = closes[target + h] / closes[target] - 1.0
        assert s.n == 1
        assert s.mean_return == pytest.approx(expected)
        assert s.median_return == pytest.approx(expected)  # single sample
        assert s.hit_rate == 1.0  # rising series -> positive


def test_triggering_every_bar_reproduces_baseline(monkeypatch):
    # A rule that fires on every eligible bar must, by construction, have the
    # exact same forward-return distribution as buy-and-hold.
    always = lambda df: RuleResult("always", True, 1.0)  # noqa: E731
    always.__name__ = "always"
    _patch_rules(monkeypatch, [always])

    closes = 100 + np.cumsum(np.random.default_rng(2).normal(0, 1, 220))
    report = run_backtest({"X": make_ohlcv(closes)}, horizons=(5, 10))
    for h in (5, 10):
        r = report.rules["always"].horizons[h]
        b = report.baseline[h]
        assert r.n == b.n
        assert r.hit_rate == pytest.approx(b.hit_rate)
        assert r.mean_return == pytest.approx(b.mean_return)
        assert r.median_return == pytest.approx(b.median_return)


# --- end-of-series window handling -----------------------------------------


def test_trigger_at_last_eligible_bar_is_counted(monkeypatch):
    closes = np.linspace(100.0, 150.0, 100)
    n, max_h = len(closes), 20
    last_eligible = n - max_h - 1  # 79
    _patch_rules(monkeypatch, [_probe(last_eligible)])
    report = run_backtest({"X": make_ohlcv(closes)}, horizons=(5, 10, 20))
    assert report.rules["probe"].triggers == 1


def test_trigger_without_full_forward_window_is_skipped(monkeypatch):
    closes = np.linspace(100.0, 150.0, 100)
    n, max_h = len(closes), 20
    too_late = n - max_h  # 80: no +20 window -> never evaluated / never counted
    _patch_rules(monkeypatch, [_probe(too_late)])
    report = run_backtest({"X": make_ohlcv(closes)}, horizons=(5, 10, 20))
    assert report.rules["probe"].triggers == 0


# --- no lookahead ----------------------------------------------------------


def test_evaluator_only_sees_growing_prefixes(monkeypatch):
    # Spy on the evaluator: every window it receives must be a contiguous prefix
    # (2, 3, 4, ... rows) and must never include the final max_h bars. A
    # lookahead bug (passing future rows) would break both assertions.
    from app.backtest import harness

    real = harness.build_signal
    seen: list[tuple] = []

    def spy(symbol, window):
        seen.append((window.index[-1], len(window)))
        return real(symbol, window)

    monkeypatch.setattr(harness, "build_signal", spy)

    df = make_ohlcv(np.linspace(100.0, 130.0, 80))
    run_backtest({"X": df}, horizons=(5,))

    lens = [n for _, n in seen]
    assert lens == list(range(2, len(lens) + 2))  # prefixes grow by exactly 1
    last_ts_seen = max(ts for ts, _ in seen)
    assert last_ts_seen < df.index[-1]  # the future max_h bars were never fed in


def test_scrambling_the_future_does_not_change_earlier_triggers(monkeypatch):
    from app.backtest import harness

    real = harness.build_signal

    def capturing_spy():
        record: dict = {}

        def spy(symbol, window):
            sig = real(symbol, window)
            record[window.index[-1]] = tuple(sorted(sig.triggered_rule_names))
            return sig

        return record, spy

    # A series with a real golden cross partway through.
    closes = np.concatenate([np.full(210, 100.0), np.linspace(100.0, 140.0, 80)])
    split = 250

    df_a = make_ohlcv(closes)
    rec_a, spy_a = capturing_spy()
    monkeypatch.setattr(harness, "build_signal", spy_a)
    run_backtest({"X": df_a}, horizons=(5,))

    # Identical up to `split`, then the future is replaced with noise.
    scrambled = closes.copy()
    scrambled[split:] = np.random.default_rng(0).uniform(1.0, 1000.0, len(closes) - split)
    df_b = make_ohlcv(scrambled)
    rec_b, spy_b = capturing_spy()
    monkeypatch.setattr(harness, "build_signal", spy_b)
    run_backtest({"X": df_b}, horizons=(5,))

    # Every trigger decision on a bar before the split must be identical — if
    # the evaluator could see the future, the scramble would change them.
    for ts in df_a.index[:split]:
        if ts in rec_a and ts in rec_b:
            assert rec_a[ts] == rec_b[ts], f"lookahead detected at {ts}"


# --- real rules on an engineered outcome -----------------------------------


def test_engineered_golden_cross_is_followed_by_a_rise():
    # Flat for 210 bars (SMA50 == SMA200), then a steady climb forces exactly
    # one golden cross, after which price only rises -> every forward return
    # from the trigger is positive.
    closes = np.concatenate([np.full(210, 100.0), np.linspace(100.0, 170.0, 90)])
    report = run_backtest({"GLD": make_ohlcv(closes)}, horizons=(5, 10, 20))

    gc = report.rules["golden_cross_momentum"]
    assert gc.triggers >= 1
    for h in (5, 10, 20):
        s = gc.horizons[h]
        assert s.hit_rate == 1.0
        assert s.mean_return > 0.0


def test_baseline_on_rising_series_is_all_positive():
    report = run_backtest({"X": make_ohlcv(np.linspace(100.0, 200.0, 260))},
                          horizons=(5, 10, 20))
    for h in (5, 10, 20):
        b = report.baseline[h]
        assert b.n > 0
        assert b.hit_rate == 1.0
        assert b.mean_return > 0.0


# --- report shape & rendering ----------------------------------------------


def test_default_horizons():
    report = run_backtest({"X": make_ohlcv(np.linspace(100.0, 150.0, 260))})
    assert report.horizons == (5, 10, 20)


def test_report_structure_and_pretty_print():
    report = run_backtest({"X": make_ohlcv(np.linspace(100.0, 150.0, 260))},
                          horizons=(5, 10, 20))
    assert isinstance(report, BacktestReport)
    assert report.symbols == ["X"]
    assert set(report.rules) == RULE_NAMES
    # every rule has stats for every horizon
    for rr in report.rules.values():
        assert set(rr.horizons) == {5, 10, 20}

    frame = report.to_frame()
    assert {"rule", "triggers", "horizon", "hit_rate", "mean_return",
            "median_return"}.issubset(frame.columns)

    text = format_report(report)
    assert "golden_cross_momentum" in text
    assert "buy_and_hold" in text
    assert "+20 hit" in text


def test_multi_symbol_aggregates_across_symbols(monkeypatch):
    always = lambda df: RuleResult("always", True, 1.0)  # noqa: E731
    always.__name__ = "always"
    _patch_rules(monkeypatch, [always])

    data = {
        "A": make_ohlcv(np.linspace(100.0, 150.0, 120)),
        "B": make_ohlcv(np.linspace(50.0, 90.0, 140)),
    }
    report = run_backtest(data, horizons=(5,))
    # Triggers/baseline pooled across both symbols' eligible bars.
    expected = (120 - 5 - 1) + (140 - 5 - 1)
    assert report.rules["always"].triggers == expected
    assert report.baseline[5].n == expected
    assert report.symbols == ["A", "B"]
