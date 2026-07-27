"""Unit tests for the swing-setup rules and the aggregation engine.

Rules are tested against small, hand-built indicator frames so each trigger
condition is exercised deterministically (no reliance on indicator warmup).
"""

from __future__ import annotations

import numpy as np
import pytest

from app.signals import build_signal, composite_score, signal_from_ohlcv
from app.signals.models import RuleResult
from app.signals.rules import (
    bollinger_mean_reversion,
    golden_cross_momentum,
    macd_bullish_crossover,
    oversold_bounce,
)
from tests.conftest import indicator_frame, make_ohlcv


# --- oversold_bounce -------------------------------------------------------


def test_oversold_bounce_triggers_on_cross_up_in_uptrend():
    df = indicator_frame(
        [
            {"rsi_14": 25.0, "close": 110.0, "sma_200": 100.0},
            {"rsi_14": 33.0, "close": 111.0, "sma_200": 100.0},
        ]
    )
    r = oversold_bounce(df)
    assert r.triggered
    assert 0.0 < r.strength <= 1.0


def test_oversold_bounce_no_trigger_below_trend():
    df = indicator_frame(
        [
            {"rsi_14": 25.0, "close": 90.0, "sma_200": 100.0},
            {"rsi_14": 33.0, "close": 91.0, "sma_200": 100.0},
        ]
    )
    assert not oversold_bounce(df).triggered


def test_oversold_bounce_no_trigger_without_cross():
    # RSI already above 30 on the prior bar -> no upward cross through 30.
    df = indicator_frame(
        [
            {"rsi_14": 35.0, "close": 110.0, "sma_200": 100.0},
            {"rsi_14": 40.0, "close": 111.0, "sma_200": 100.0},
        ]
    )
    assert not oversold_bounce(df).triggered


# --- golden_cross_momentum -------------------------------------------------


def test_golden_cross_triggers():
    df = indicator_frame(
        [
            {"sma_50": 99.0, "sma_200": 100.0, "close": 101.0},
            {"sma_50": 101.0, "sma_200": 100.0, "close": 105.0},
        ]
    )
    r = golden_cross_momentum(df)
    assert r.triggered
    assert r.strength >= 0.5


def test_golden_cross_no_trigger_when_already_above():
    df = indicator_frame(
        [
            {"sma_50": 101.0, "sma_200": 100.0, "close": 105.0},
            {"sma_50": 102.0, "sma_200": 100.0, "close": 106.0},
        ]
    )
    assert not golden_cross_momentum(df).triggered


# --- macd_bullish_crossover ------------------------------------------------


def test_macd_cross_near_zero_is_strong():
    df = indicator_frame(
        [
            {"macd": -0.20, "macd_signal": -0.10, "atr_14": 1.0, "close": 100.0},
            {"macd": 0.02, "macd_signal": 0.00, "atr_14": 1.0, "close": 100.0},
        ]
    )
    r = macd_bullish_crossover(df)
    assert r.triggered
    assert r.strength > 0.9  # near zero -> high nearness


def test_macd_cross_far_from_zero_is_weaker():
    df = indicator_frame(
        [
            {"macd": 1.80, "macd_signal": 1.90, "atr_14": 1.0, "close": 100.0},
            {"macd": 2.10, "macd_signal": 2.00, "atr_14": 1.0, "close": 100.0},
        ]
    )
    r = macd_bullish_crossover(df)
    assert r.triggered
    assert r.strength < 0.6  # >1 ATR from zero -> low nearness


def test_macd_no_trigger_without_cross():
    df = indicator_frame(
        [
            {"macd": 0.5, "macd_signal": 0.1, "atr_14": 1.0, "close": 100.0},
            {"macd": 0.6, "macd_signal": 0.2, "atr_14": 1.0, "close": 100.0},
        ]
    )
    assert not macd_bullish_crossover(df).triggered


# --- bollinger_mean_reversion ----------------------------------------------


def test_bollinger_reentry_triggers():
    df = indicator_frame(
        [
            {"close": 95.0, "bb_lower": 96.0, "bb_mid": 100.0},
            {"close": 99.0, "bb_lower": 97.0, "bb_mid": 100.0},
        ]
    )
    r = bollinger_mean_reversion(df)
    assert r.triggered
    assert r.strength >= 0.5


def test_bollinger_no_trigger_when_never_below():
    df = indicator_frame(
        [
            {"close": 98.0, "bb_lower": 96.0, "bb_mid": 100.0},
            {"close": 99.0, "bb_lower": 97.0, "bb_mid": 100.0},
        ]
    )
    assert not bollinger_mean_reversion(df).triggered


def test_bollinger_no_trigger_when_still_outside():
    df = indicator_frame(
        [
            {"close": 95.0, "bb_lower": 96.0, "bb_mid": 100.0},
            {"close": 96.5, "bb_lower": 97.0, "bb_mid": 100.0},  # still below band
        ]
    )
    assert not bollinger_mean_reversion(df).triggered


# --- insufficient data safety ----------------------------------------------


@pytest.mark.parametrize(
    "rule",
    [
        oversold_bounce,
        golden_cross_momentum,
        macd_bullish_crossover,
        bollinger_mean_reversion,
    ],
)
def test_rules_safe_on_single_row(rule):
    df = indicator_frame([{"rsi_14": 25.0, "close": 100.0, "sma_200": 90.0}])
    r = rule(df)
    assert isinstance(r, RuleResult)
    assert not r.triggered


# --- engine / aggregation --------------------------------------------------


def test_ruleresult_clamps_strength():
    assert RuleResult("x", True, 5.0).strength == 1.0
    assert RuleResult("x", True, -3.0).strength == 0.0


def test_composite_score_zero_when_nothing_triggers():
    assert composite_score([RuleResult("a", False, 0.9)]) == 0.0


def test_composite_score_is_weighted_mean():
    results = [
        RuleResult("golden_cross_momentum", True, 1.0),
        RuleResult("bollinger_mean_reversion", True, 0.0),
    ]
    score = composite_score(results)
    # Weighted mean with weights 1.2 and 0.9: (1.2*1 + 0.9*0)/(1.2+0.9)
    assert score == pytest.approx(1.2 / 2.1)


def test_build_signal_neutral_when_no_triggers():
    df = indicator_frame(
        [
            {
                "rsi_14": 50.0,
                "close": 100.0,
                "sma_20": 100,
                "sma_50": 100,
                "sma_200": 100,
                "atr_14": 1.0,
                "macd": 0.0,
                "macd_signal": 0.0,
                "bb_lower": 95,
                "bb_mid": 100,
                "bb_upper": 105,
            }
        ]
        * 2
    )
    sig = build_signal("TEST", df)
    assert sig.direction == "neutral"
    assert sig.composite_score == 0.0
    assert sig.triggered_rules == []


def test_build_signal_sets_stop_and_levels():
    df = indicator_frame(
        [
            {
                "rsi_14": 25.0,
                "close": 110.0,
                "sma_20": 108,
                "sma_50": 105,
                "sma_200": 100.0,
                "atr_14": 2.0,
                "macd": -0.2,
                "macd_signal": -0.1,
                "bb_lower": 104,
                "bb_mid": 108,
                "bb_upper": 112,
            },
            {
                "rsi_14": 33.0,
                "close": 111.0,
                "sma_20": 108,
                "sma_50": 105,
                "sma_200": 100.0,
                "atr_14": 2.0,
                "macd": 0.02,
                "macd_signal": 0.0,
                "bb_lower": 104,
                "bb_mid": 108,
                "bb_upper": 112,
            },
        ]
    )
    sig = build_signal("TEST", df)
    assert sig.direction == "long"
    assert "oversold_bounce" in sig.triggered_rule_names
    # Stop = close - 2*ATR = 111 - 4 = 107
    assert sig.suggested_stop == pytest.approx(107.0)
    assert sig.key_levels["sma_200"] == pytest.approx(100.0)
    assert sig.to_dict()["symbol"] == "TEST"


def test_signal_from_ohlcv_end_to_end_runs():
    # A realistic-length series should compute indicators and build a signal
    # without raising, regardless of whether anything triggers.
    closes = 100 + np.cumsum(np.random.default_rng(7).normal(0, 1, 260))
    df = make_ohlcv(closes)
    sig = signal_from_ohlcv("SYNTH", df)
    assert sig.symbol == "SYNTH"
    assert sig.direction in {"long", "neutral"}
    assert 0.0 <= sig.composite_score <= 1.0
