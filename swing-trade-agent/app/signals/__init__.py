"""Deterministic swing-signal rules engine."""

from app.signals.engine import (
    ATR_STOP_MULTIPLE,
    RULE_WEIGHTS,
    build_signal,
    composite_score,
    evaluate_rules,
    signal_from_ohlcv,
)
from app.signals.models import RuleResult, Signal
from app.signals.rules import RULES, RULES_BY_NAME

__all__ = [
    "ATR_STOP_MULTIPLE",
    "RULE_WEIGHTS",
    "RULES",
    "RULES_BY_NAME",
    "RuleResult",
    "Signal",
    "build_signal",
    "composite_score",
    "evaluate_rules",
    "signal_from_ohlcv",
]
