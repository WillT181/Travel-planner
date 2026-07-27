"""Structured signal data models.

These dataclasses are the ONLY thing handed to the reasoning (LLM) layer. They
carry already-computed numbers so the model never does any signal math.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class RuleResult:
    """Outcome of a single swing-setup rule at one point in time."""

    name: str
    triggered: bool
    strength: float  # 0.0 - 1.0
    detail: str = ""

    def __post_init__(self) -> None:
        # Clamp strength defensively so downstream scoring is always in-range.
        object.__setattr__(self, "strength", float(min(1.0, max(0.0, self.strength))))


@dataclass(frozen=True)
class Signal:
    """Aggregated per-symbol signal object."""

    symbol: str
    direction: str  # "long" | "neutral"
    composite_score: float  # 0.0 - 1.0
    triggered_rules: list[RuleResult] = field(default_factory=list)
    key_levels: dict[str, float] = field(default_factory=dict)
    suggested_stop: float | None = None
    atr: float | None = None
    as_of: str | None = None  # ISO date of the evaluated bar

    @property
    def triggered_rule_names(self) -> list[str]:
        return [r.name for r in self.triggered_rules]

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        # asdict already recurses into RuleResult; ensure floats are plain.
        data["composite_score"] = round(self.composite_score, 4)
        return data
