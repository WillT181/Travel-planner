"""LLM reasoning layer — turns structured signals into plain-English notes.

Narration only: the LLM never computes or overrides a signal (see claude.py).
"""

from app.reasoning.claude import (
    ReasoningError,
    build_prompt,
    explain_signal,
    explain_signals,
    fallback_rationale,
)

__all__ = [
    "ReasoningError",
    "build_prompt",
    "explain_signal",
    "explain_signals",
    "fallback_rationale",
]
