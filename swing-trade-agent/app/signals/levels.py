"""Trade levels — turn a Signal into concrete, checkable numbers.

A composite score says *whether* a setup exists. This module says *where* it
lives: an entry zone, the risk per share implied by the ATR stop, an R-multiple
ladder, the nearest overhead level that would cap the move, and the position
size that follows from a fixed risk budget.

All of it is deterministic arithmetic derived from numbers the signal engine
already computed. **No LLM is involved and nothing here places an order** — it
states the consequences of a stop the engine chose, so a human can judge the
setup. It is not advice and does not predict anything.

Two deliberate choices keep the output honest:

1. **The reference entry is the worst fill in the zone** (the top for a long),
   so risk is never understated and reward:risk is never flattered.
2. **Reward:risk is measured against the nearest overhead level**, not against
   an R-multiple. Targets placed at "2R" make reward:risk 2.0 by definition —
   a tautology. Measuring to real resistance can say "there is only 0.6R of room
   before the 50-day average", which is a fact worth knowing.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from app.config import Config, load_config
from app.signals.models import Signal

# Entry band, in ATR multiples around the last close. Asymmetric on purpose:
# there is more room to buy a dip than to chase, because paying up raises the
# entry, widens risk against a fixed stop, and degrades reward:risk.
ENTRY_PULLBACK_ATR = 0.5
ENTRY_CHASE_ATR = 0.25

# R-multiples reported as a scale-out ladder.
R_LADDER = (1.0, 2.0, 3.0)

# Overhead levels that could cap a move, nearest-first at evaluation time.
RESISTANCE_LEVELS = ("bb_upper", "sma_20", "ema_20", "sma_50", "ema_50", "sma_200")

# Ignore "resistance" sitting essentially on top of the entry — noise, not a level.
MIN_RESISTANCE_DISTANCE_ATR = 0.1

DISCLAIMER = (
    "Arithmetic derived from the engine's ATR stop. Decision support for review "
    "— not advice, not a prediction, and no order is placed."
)


@dataclass(frozen=True)
class TradePlan:
    """Concrete levels implied by a signal. All prices in the symbol's currency."""

    symbol: str
    direction: str

    # Where the setup is still valid to enter.
    entry_low: float
    entry_high: float
    reference_entry: float  # worst fill in the zone — all risk math uses this

    stop: float
    risk_per_share: float

    # Scale-out ladder at fixed R multiples off the reference entry.
    r_targets: dict[str, float] = field(default_factory=dict)

    # Nearest level overhead that could cap the move, and the honest R:R to it.
    resistance: float | None = None
    resistance_label: str | None = None
    reward_risk: float | None = None
    meets_min_reward_risk: bool | None = None

    # Position sizing — populated only when ACCOUNT_SIZE is configured.
    shares: int | None = None
    notional: float | None = None
    risk_amount: float | None = None
    sizing_note: str = ""

    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "direction": self.direction,
            "entry_zone": [self.entry_low, self.entry_high],
            "reference_entry": self.reference_entry,
            "stop": self.stop,
            "risk_per_share": self.risk_per_share,
            "r_targets": self.r_targets,
            "resistance": self.resistance,
            "resistance_label": self.resistance_label,
            "reward_risk": self.reward_risk,
            "meets_min_reward_risk": self.meets_min_reward_risk,
            "shares": self.shares,
            "notional": self.notional,
            "risk_amount": self.risk_amount,
            "sizing_note": self.sizing_note,
            "notes": self.notes,
            "basis": DISCLAIMER,
        }

    def summary(self) -> str:
        """One-line human summary, e.g. for the digest or a chat reply."""
        parts = [
            f"entry {self.entry_low:g}–{self.entry_high:g}",
            f"stop {self.stop:g}",
            f"risk/share {self.risk_per_share:g}",
        ]
        if self.reward_risk is not None and self.resistance is not None:
            parts.append(
                f"R:R {self.reward_risk:g} to {self.resistance_label} {self.resistance:g}"
            )
        if self.shares:
            parts.append(f"{self.shares} share(s) risking {self.risk_amount:g}")
        return f"{self.symbol}: " + ", ".join(parts)


def _nearest_resistance(
    levels: dict[str, float], entry: float, atr: float
) -> tuple[str, float] | None:
    """The closest level meaningfully above ``entry`` — the first obstacle."""
    floor_distance = MIN_RESISTANCE_DISTANCE_ATR * atr
    candidates = [
        (name, levels[name])
        for name in RESISTANCE_LEVELS
        if name in levels and levels[name] - entry > floor_distance
    ]
    if not candidates:
        return None
    return min(candidates, key=lambda pair: pair[1])


def _size_position(
    config: Config, entry: float, risk_per_share: float
) -> tuple[int | None, float | None, float | None, str]:
    """Shares from a fixed fractional risk budget, capped by max position size."""
    account = config.account_size
    if not account or account <= 0:
        return None, None, None, (
            "Set ACCOUNT_SIZE (and optionally RISK_PER_TRADE_PCT) in .env for sizing."
        )
    if risk_per_share <= 0:
        return None, None, None, "Risk per share is not positive; cannot size."

    risk_budget = account * (config.risk_per_trade_pct / 100.0)
    shares = math.floor(risk_budget / risk_per_share)
    note = f"{config.risk_per_trade_pct:g}% of {account:g} = {round(risk_budget, 2):g} at risk"

    # Cap notional exposure so one setup can't dominate the account even when
    # a tight stop makes the risk-based size very large.
    max_notional = account * (config.max_position_pct / 100.0)
    capped = math.floor(max_notional / entry) if entry > 0 else 0
    if capped < shares:
        shares = capped
        note += f"; capped at {config.max_position_pct:g}% position size"

    if shares <= 0:
        return 0, 0.0, 0.0, note + "; position rounds to zero shares"

    return (
        shares,
        round(shares * entry, 2),
        round(shares * risk_per_share, 2),
        note,
    )


def build_trade_plan(signal: Signal, config: Config | None = None) -> TradePlan | None:
    """Derive concrete levels from a signal, or ``None`` when it can't be done.

    Returns ``None`` for a neutral signal (no setup to plan), or when the
    engine could not produce the close / ATR / stop the arithmetic needs.
    """
    config = config or load_config()

    if signal.direction != "long":
        return None

    close = signal.key_levels.get("close")
    atr = signal.atr
    stop = signal.suggested_stop
    if close is None or not atr or atr <= 0 or stop is None:
        return None

    notes: list[str] = []

    entry_low = round(close - ENTRY_PULLBACK_ATR * atr, 4)
    entry_high = round(close + ENTRY_CHASE_ATR * atr, 4)
    # Worst fill in the zone: never understate risk.
    reference_entry = entry_high

    risk_per_share = round(reference_entry - stop, 4)
    if risk_per_share <= 0:
        # A stop at or above the entry defines no risk — refuse rather than
        # emit numbers that would divide by zero downstream.
        return None

    r_targets = {
        f"{m:g}R": round(reference_entry + m * risk_per_share, 4) for m in R_LADDER
    }

    resistance_label: str | None = None
    resistance: float | None = None
    reward_risk: float | None = None
    meets_min: bool | None = None

    found = _nearest_resistance(signal.key_levels, reference_entry, atr)
    if found is None:
        notes.append(
            "No tracked level sits above the entry, so there is no measured "
            "reward:risk — the R ladder is the only reference."
        )
    else:
        resistance_label, resistance = found
        reward_risk = round((resistance - reference_entry) / risk_per_share, 2)
        meets_min = reward_risk >= config.min_reward_risk
        if not meets_min:
            notes.append(
                f"Only {reward_risk:g}R of room to {resistance_label} — below the "
                f"{config.min_reward_risk:g} minimum, so location is poor even "
                "though the setup triggered."
            )

    shares, notional, risk_amount, sizing_note = _size_position(
        config, reference_entry, risk_per_share
    )

    if entry_low <= stop:
        notes.append(
            "The lower entry band sits at or below the stop; treat the upper "
            "half of the zone as the usable range."
        )

    return TradePlan(
        symbol=signal.symbol,
        direction=signal.direction,
        entry_low=entry_low,
        entry_high=entry_high,
        reference_entry=reference_entry,
        stop=stop,
        risk_per_share=risk_per_share,
        r_targets=r_targets,
        resistance=resistance,
        resistance_label=resistance_label,
        reward_risk=reward_risk,
        meets_min_reward_risk=meets_min,
        shares=shares,
        notional=notional,
        risk_amount=risk_amount,
        sizing_note=sizing_note,
        notes=notes,
    )
