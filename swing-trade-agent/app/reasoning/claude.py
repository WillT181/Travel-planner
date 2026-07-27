"""Anthropic-backed rationale generation.

The LLM's ONLY job is to translate an already-computed :class:`Signal` into a
short, readable rationale. It never computes indicators or invents numbers —
the system prompt makes that explicit, and we only ever pass it the structured
signal JSON we produced deterministically upstream.

If no API key is configured (or the SDK isn't installed), we degrade to a
deterministic template rationale so the pipeline still produces output.
"""

from __future__ import annotations

import json

from app.config import Config, load_config
from app.signals.models import Signal

SYSTEM_PROMPT = (
    "You are a trading-signal explainer for a decision-support tool. You are "
    "given a JSON object of ALREADY-COMPUTED technical indicator values and "
    "triggered rules for one stock. Your job is ONLY to explain, in plain "
    "English, what these signals mean together.\n\n"
    "Hard rules:\n"
    "- Reason ONLY from the numbers provided. Never invent prices, dates, "
    "fundamentals, news, or indicator values that are not in the JSON.\n"
    "- Do NOT recompute or second-guess the indicators or the composite score.\n"
    "- This is decision support, NOT financial advice, and NOT an instruction "
    "to trade. Never tell the user to buy or sell.\n"
    "- Be concise and specific, citing the actual numbers you were given.\n\n"
    "Structure your answer as three short labelled parts:\n"
    "1. Setup — what the triggered rules and key levels mean together.\n"
    "2. Invalidation — the specific condition/level that would negate the "
    "setup (e.g. a close back below a named level or stop).\n"
    "3. Risk note — one sentence on risk, referencing the ATR-based stop "
    "distance as context only."
)

MAX_TOKENS = 600
TEMPERATURE = 0.2


class ReasoningError(RuntimeError):
    """Raised when the Anthropic call fails and no fallback is desired."""


def build_prompt(signal: Signal) -> str:
    """The user-message payload: the structured signal JSON only."""
    payload = signal.to_dict()
    return (
        "Explain the following swing-trade signal. Use ONLY these numbers:\n\n"
        f"{json.dumps(payload, indent=2)}"
    )


def fallback_rationale(signal: Signal) -> str:
    """Deterministic, template-based rationale (no LLM)."""
    rules = ", ".join(signal.triggered_rule_names) or "no rules"
    close = signal.key_levels.get("close")
    sma200 = signal.key_levels.get("sma_200")
    parts = [
        f"**Setup** — {signal.symbol}: {rules} triggered "
        f"(composite score {signal.composite_score:.2f}, direction "
        f"{signal.direction}).",
    ]
    if close is not None and sma200 is not None:
        rel = "above" if close >= sma200 else "below"
        parts.append(
            f"Price {close:.2f} is {rel} the SMA200 ({sma200:.2f}), the "
            "longer-term trend reference."
        )
    if signal.suggested_stop is not None:
        parts.append(
            f"**Invalidation** — a daily close back below the suggested "
            f"stop context of {signal.suggested_stop:.2f} would negate the setup."
        )
    if signal.atr is not None:
        parts.append(
            f"**Risk note** — ATR(14) is {signal.atr:.2f}; the stop context is "
            "2×ATR below the close. Decision support only — not a trade "
            "instruction."
        )
    return " ".join(parts)


def explain_signal(
    signal: Signal,
    config: Config | None = None,
    allow_fallback: bool = True,
) -> str:
    """Return a plain-English rationale for a signal.

    Uses the Anthropic API when configured; otherwise (or on error, if
    ``allow_fallback``) returns the deterministic template rationale.
    """
    config = config or load_config()

    if not config.anthropic_api_key:
        if allow_fallback:
            return fallback_rationale(signal)
        raise ReasoningError("ANTHROPIC_API_KEY not set")

    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - env dependent
        if allow_fallback:
            return fallback_rationale(signal)
        raise ReasoningError("anthropic SDK not installed") from exc

    try:
        client = anthropic.Anthropic(api_key=config.anthropic_api_key)
        message = client.messages.create(
            model=config.llm_model,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": build_prompt(signal)}],
        )
        text = "".join(
            block.text for block in message.content if getattr(block, "type", "") == "text"
        ).strip()
        return text or fallback_rationale(signal)
    except Exception as exc:  # pragma: no cover - network dependent
        if allow_fallback:
            return fallback_rationale(signal)
        raise ReasoningError(f"Anthropic call failed: {exc}") from exc
