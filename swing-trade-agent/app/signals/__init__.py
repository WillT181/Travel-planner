"""Deterministic swing-signal rules engine."""

from app.signals.engine import (
    ATR_STOP_MULTIPLE,
    REQUIRED_COLUMNS,
    RULE_WEIGHTS,
    build_signal,
    composite_score,
    confirmation_bonus,
    evaluate_rules,
    signal_from_ohlcv,
)
from app.signals.levels import TradePlan, build_trade_plan
from app.signals.models import RuleResult, Signal
from app.signals.rules import RULES, RULES_BY_NAME

__all__ = [
    "ATR_STOP_MULTIPLE",
    "REQUIRED_COLUMNS",
    "RULE_WEIGHTS",
    "RULES",
    "RULES_BY_NAME",
    "RuleResult",
    "Signal",
    "TradePlan",
    "build_signal",
    "build_trade_plan",
    "composite_score",
    "confirmation_bonus",
    "evaluate_rules",
    "signal_from_ohlcv",
]
