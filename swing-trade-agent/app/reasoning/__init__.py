"""LLM reasoning layer — turns structured signals into plain-English notes."""

from app.reasoning.claude import (
    ReasoningError,
    build_prompt,
    explain_signal,
    fallback_rationale,
)

__all__ = [
    "ReasoningError",
    "build_prompt",
    "explain_signal",
    "fallback_rationale",
]
