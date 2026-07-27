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
        """Flatten to the Supabase ``signals`` table row shape.

        Column names match ``supabase/0001_signals.sql``: ``triggered_rules``
        and ``key_levels`` land in JSONB columns.
        """
        return {
            "timestamp": self.generated_at,
            "as_of": self.signal.as_of,
            "symbol": self.signal.symbol,
            "composite_score": self.signal.composite_score,
            "triggered_rules": self.signal.triggered_rule_names,
            "key_levels": self.signal.key_levels,
            "suggested_stop": self.signal.suggested_stop,
            "rationale": self.rationale,
        }
