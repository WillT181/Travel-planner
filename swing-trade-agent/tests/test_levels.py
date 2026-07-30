"""Tests for trade-level arithmetic.

Trust-critical: these numbers are what a human would act on, so every value is
asserted against a hand-computed expectation rather than a recomputation of the
implementation. The two properties that matter most:

* risk is measured from the WORST fill in the entry zone, so it is never
  understated;
* reward:risk is measured to real overhead resistance, so it cannot be the
  tautology that R-multiple targets would produce.
"""

from __future__ import annotations

import pytest

from app.config import Config
from app.signals.levels import (
    ENTRY_CHASE_ATR,
    ENTRY_PULLBACK_ATR,
    build_trade_plan,
)
from app.signals.models import RuleResult, Signal

_ENV = (
    "ACCOUNT_SIZE",
    "RISK_PER_TRADE_PCT",
    "MAX_POSITION_PCT",
    "MIN_REWARD_RISK",
)


@pytest.fixture
def cfg(monkeypatch):
    """Config with sizing knobs unset unless a test sets them."""
    for name in _ENV:
        monkeypatch.delenv(name, raising=False)
    return lambda **env: (
        [monkeypatch.setenv(k, str(v)) for k, v in env.items()],
        Config(),
    )[1]


def _signal(
    *,
    close: float = 100.0,
    atr: float = 4.0,
    stop: float | None = 92.0,
    direction: str = "long",
    levels: dict | None = None,
) -> Signal:
    key_levels = {"close": close}
    if levels:
        key_levels.update(levels)
    return Signal(
        symbol="TEST",
        direction=direction,
        composite_score=0.7,
        triggered_rules=[RuleResult("oversold_bounce", True, 0.7)],
        key_levels=key_levels,
        suggested_stop=stop,
        atr=atr,
        as_of="2026-07-30",
    )


class TestEntryZone:
    def test_zone_is_atr_scaled_and_asymmetric(self, cfg):
        # close 100, atr 4 -> low = 100 - 0.5*4 = 98, high = 100 + 0.25*4 = 101
        plan = build_trade_plan(_signal(), cfg())
        assert plan.entry_low == 98.0
        assert plan.entry_high == 101.0
        # More room below than above: chasing costs reward:risk.
        assert ENTRY_PULLBACK_ATR > ENTRY_CHASE_ATR

    def test_reference_entry_is_the_worst_fill(self, cfg):
        """Risk must never be flattered by assuming the best entry."""
        plan = build_trade_plan(_signal(), cfg())
        assert plan.reference_entry == plan.entry_high

    def test_risk_per_share_uses_worst_fill(self, cfg):
        # 101 (worst fill) - 92 (stop) = 9, NOT 100 - 92 = 8
        plan = build_trade_plan(_signal(), cfg())
        assert plan.risk_per_share == 9.0


class TestRLadder:
    def test_targets_are_multiples_of_risk_off_the_reference_entry(self, cfg):
        plan = build_trade_plan(_signal(), cfg())
        assert plan.r_targets == {"1R": 110.0, "2R": 119.0, "3R": 128.0}


class TestRewardRisk:
    def test_measured_to_nearest_overhead_level(self, cfg):
        # Nearest level above entry 101 is sma_50 at 110 -> (110-101)/9 = 1.0
        plan = build_trade_plan(
            _signal(levels={"sma_50": 110.0, "sma_200": 140.0}), cfg()
        )
        assert plan.resistance_label == "sma_50"
        assert plan.resistance == 110.0
        assert plan.reward_risk == 1.0

    def test_is_not_the_r_multiple_tautology(self, cfg):
        """A 2R target would force R:R == 2; real resistance must not."""
        plan = build_trade_plan(_signal(levels={"sma_50": 110.0}), cfg())
        assert plan.reward_risk != 2.0

    def test_levels_below_entry_are_ignored(self, cfg):
        plan = build_trade_plan(
            _signal(levels={"sma_200": 80.0, "bb_upper": 130.0}), cfg()
        )
        assert plan.resistance_label == "bb_upper"

    def test_level_hugging_the_entry_is_noise_not_resistance(self, cfg):
        # atr 4 -> anything within 0.4 of entry 101 is ignored.
        plan = build_trade_plan(
            _signal(levels={"sma_20": 101.2, "sma_50": 115.0}), cfg()
        )
        assert plan.resistance_label == "sma_50"

    def test_poor_location_is_flagged_with_a_note(self, cfg):
        # Resistance at 105 -> (105-101)/9 = 0.44R, below the 1.5 default.
        plan = build_trade_plan(_signal(levels={"sma_50": 105.0}), cfg())
        assert plan.meets_min_reward_risk is False
        assert any("below the" in n for n in plan.notes)

    def test_good_location_passes(self, cfg):
        plan = build_trade_plan(_signal(levels={"sma_50": 130.0}), cfg())
        assert plan.meets_min_reward_risk is True
        assert plan.notes == []

    def test_threshold_is_configurable(self, cfg):
        config = cfg(MIN_REWARD_RISK=0.3)
        plan = build_trade_plan(_signal(levels={"sma_50": 105.0}), config)
        assert plan.meets_min_reward_risk is True

    def test_no_overhead_level_reports_none_not_zero(self, cfg):
        plan = build_trade_plan(_signal(), cfg())
        assert plan.reward_risk is None
        assert plan.meets_min_reward_risk is None
        assert any("no measured reward:risk" in n for n in plan.notes)


class TestPositionSizing:
    def test_absent_account_size_gives_no_share_count(self, cfg):
        plan = build_trade_plan(_signal(), cfg())
        assert plan.shares is None
        assert "ACCOUNT_SIZE" in plan.sizing_note

    def test_shares_follow_the_risk_budget(self, cfg):
        # 1% of 10,000 = 100 risk budget; risk/share 9 -> floor(100/9) = 11
        config = cfg(ACCOUNT_SIZE=10_000, RISK_PER_TRADE_PCT=1)
        plan = build_trade_plan(_signal(), config)
        assert plan.shares == 11
        assert plan.risk_amount == 99.0  # 11 * 9
        assert plan.notional == 1111.0  # 11 * 101

    def test_risk_percentage_is_respected(self, cfg):
        # 2% of 10,000 = 200 budget; floor(200/9) = 22 shares.
        # Raise the notional cap so the risk budget is the binding constraint:
        # 22 shares * 101 = 2,222 would otherwise trip the default 20% cap.
        config = cfg(ACCOUNT_SIZE=10_000, RISK_PER_TRADE_PCT=2, MAX_POSITION_PCT=50)
        plan = build_trade_plan(_signal(), config)
        assert plan.shares == 22
        assert "capped" not in plan.sizing_note

    def test_notional_cap_binds_before_the_risk_budget_when_it_is_smaller(self, cfg):
        """At 2% risk the position would be 22.2% of the account — the cap wins."""
        config = cfg(ACCOUNT_SIZE=10_000, RISK_PER_TRADE_PCT=2, MAX_POSITION_PCT=20)
        plan = build_trade_plan(_signal(), config)
        assert plan.shares == 19  # floor(2,000 / 101)
        assert "capped" in plan.sizing_note

    def test_max_position_cap_binds_on_a_tight_stop(self, cfg):
        """A tight stop implies a huge risk-based size; the notional cap limits it."""
        # stop 100.5 vs entry 101 -> risk 0.5/share; 1% of 10,000 = 100 budget
        # -> 200 shares by risk, but 20% of 10,000 = 2,000 / 101 = 19 shares.
        config = cfg(ACCOUNT_SIZE=10_000, RISK_PER_TRADE_PCT=1, MAX_POSITION_PCT=20)
        plan = build_trade_plan(_signal(stop=100.5), config)
        assert plan.shares == 19
        assert "capped" in plan.sizing_note

    def test_account_too_small_reports_zero_not_a_crash(self, cfg):
        config = cfg(ACCOUNT_SIZE=50, RISK_PER_TRADE_PCT=1)
        plan = build_trade_plan(_signal(), config)
        assert plan.shares == 0
        assert "zero shares" in plan.sizing_note


class TestNoPlanCases:
    def test_neutral_signal_has_no_plan(self, cfg):
        assert build_trade_plan(_signal(direction="neutral"), cfg()) is None

    @pytest.mark.parametrize(
        "kwargs",
        [
            {"stop": None},
            {"atr": None},
            {"atr": 0.0},
        ],
    )
    def test_missing_inputs_give_no_plan(self, cfg, kwargs):
        assert build_trade_plan(_signal(**kwargs), cfg()) is None

    def test_stop_above_entry_is_refused(self, cfg):
        """Non-positive risk would divide by zero downstream."""
        assert build_trade_plan(_signal(stop=105.0), cfg()) is None

    def test_missing_close_gives_no_plan(self, cfg):
        sig = Signal(
            symbol="TEST",
            direction="long",
            composite_score=0.7,
            key_levels={},
            suggested_stop=92.0,
            atr=4.0,
        )
        assert build_trade_plan(sig, cfg()) is None


class TestSerialisation:
    def test_to_dict_carries_the_non_advice_basis(self, cfg):
        plan = build_trade_plan(_signal(levels={"sma_50": 130.0}), cfg())
        data = plan.to_dict()
        assert data["entry_zone"] == [98.0, 101.0]
        assert data["reward_risk"] == plan.reward_risk
        assert "not advice" in data["basis"]

    def test_summary_is_one_readable_line(self, cfg):
        config = cfg(ACCOUNT_SIZE=10_000)
        plan = build_trade_plan(_signal(levels={"sma_50": 130.0}), config)
        text = plan.summary()
        assert text.startswith("TEST:")
        assert "\n" not in text
        assert "stop 92" in text


class TestDigestIntegration:
    def test_levels_appear_in_the_markdown_digest(self, cfg, monkeypatch):
        for name in _ENV:
            monkeypatch.delenv(name, raising=False)
        from app.output.digest import render_markdown_digest
        from app.output.models import SignalReport

        report = SignalReport(
            signal=_signal(levels={"sma_50": 130.0}), rationale="Because reasons."
        )
        text = render_markdown_digest([report])
        assert "Entry zone:" in text
        assert "98.00–101.00" in text
        assert "R ladder:" in text
        assert "Reward:risk:" in text
