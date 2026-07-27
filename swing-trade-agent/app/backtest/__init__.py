"""Backtest harness for validating signal rules against history."""

from app.backtest.harness import (
    BacktestResult,
    RuleStats,
    backtest_rules,
    backtest_symbol,
    summarize,
)

__all__ = [
    "BacktestResult",
    "RuleStats",
    "backtest_rules",
    "backtest_symbol",
    "summarize",
]
