"""Output-layer data models."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from app.signals.models import Signal


@dataclass(frozen=True)
class SignalReport:
    """A signal paired with its (LLM or fallback) rationale, ready to emit."""

    signal: Signal
    rationale: str
    generated_at: str = field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc).isoformat()
    )

    def to_row(self) -> dict:
        """Flatten to the Supabase ``signals`` table row shape."""
        return {
            "generated_at": self.generated_at,
            "as_of": self.signal.as_of,
            "symbol": self.signal.symbol,
            "direction": self.signal.direction,
            "score": self.signal.composite_score,
            "rules": self.signal.triggered_rule_names,
            "key_levels": self.signal.key_levels,
            "suggested_stop": self.signal.suggested_stop,
            "atr": self.signal.atr,
            "rationale": self.rationale,
        }
