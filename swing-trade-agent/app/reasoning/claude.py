"""Anthropic-backed rationale generation.

NARRATION ONLY. This module is the single place an LLM appears in the whole
system, and its role is strictly to narrate: it converts an already-computed
:class:`Signal` (the deterministic output of the rules engine) into a short,
readable rationale. It never computes, infers, or overrides any signal — every
number it talks about was produced upstream in pure Python. The system prompt
enforces this, and we only ever hand the model the structured signal JSON.

If no API key is configured (or the SDK isn't installed, or the call fails), we
degrade to a deterministic template rationale so a failed explanation can never
crash the pipeline.
"""

from __future__ import annotations

import json
from typing import Iterable

from app.config import Config, load_config
from app.signals.models import Signal

SYSTEM_PROMPT = (
    "You are a trading-signal explainer for a decision-support tool. You are "
    "given a JSON object of ALREADY-COMPUTED technical indicator values and "
    "triggered rules for one stock. Your ONLY job is to explain, in plain "
    "English, what these signals mean together.\n\n"
    "Hard rules:\n"
    "- Reason ONLY from the numbers provided in the JSON. NEVER invent prices, "
    "price targets, dates, fundamentals, news, analyst opinions, or indicator "
    "values that are not present in the input.\n"
    "- Do NOT recompute, adjust, or second-guess the indicators, the triggered "
    "rules, or the composite score. Take them as given.\n"
    "- If the data is thin or a field is missing, say so plainly rather than "
    "embellishing or padding with generic market commentary.\n"
    "- This is decision support, NOT financial advice, and NOT an instruction "
    "to trade. Never tell the user to buy or sell.\n"
    "- Be concise and specific, citing the actual numbers you were given.\n\n"
    "Respond with exactly these three short labelled parts and nothing else "
    "(no preamble, no exploratory reasoning):\n"
    "1. Setup — what the triggered rules and key levels mean together.\n"
    "2. Invalidation — the specific price action or level that would negate the "
    "setup (e.g. a daily close back below a named level or the suggested stop).\n"
    "3. Risk note — one sentence on risk, referencing the ATR-based stop "
    "distance as context only."
)

MAX_TOKENS = 600

# The requested "low temperature" maps to effort=low on claude-opus-4-8: that
# model rejects the `temperature`/`top_p`/`top_k` sampling parameters (HTTP 400),
# so determinism/economy is steered via output_config effort plus the tight
# prompt above rather than a temperature knob.
EFFORT = "low"


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
    """Return a plain-English rationale for a single signal.

    Uses the Anthropic API when ``ANTHROPIC_API_KEY`` is configured; otherwise
    (or on any error, when ``allow_fallback``) returns the deterministic
    template rationale so the pipeline keeps producing output.
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
            system=SYSTEM_PROMPT,
            output_config={"effort": EFFORT},
            messages=[{"role": "user", "content": build_prompt(signal)}],
        )
        text = "".join(
            block.text
            for block in message.content
            if getattr(block, "type", "") == "text"
        ).strip()
        return text or fallback_rationale(signal)
    except Exception as exc:  # noqa: BLE001 - a failed explanation must not crash
        if allow_fallback:
            return fallback_rationale(signal)
        raise ReasoningError(f"Anthropic call failed: {exc}") from exc


def explain_signals(
    signals: Iterable[Signal],
    threshold: float | None = None,
    config: Config | None = None,
):
    """Narrate every signal whose composite score clears ``threshold``.

    Returns a list of ``SignalReport`` (signal + rationale), one per signal
    above the threshold. ``threshold`` defaults to ``config.signal_threshold``.
    Signals at or above the threshold are explained; the rest are skipped
    entirely (no LLM call, no cost).
    """
    config = config or load_config()
    if threshold is None:
        threshold = config.signal_threshold

    # Imported lazily to keep the reasoning layer importable without the output
    # layer, and to avoid any import cycle.
    from app.output.models import SignalReport

    reports = []
    for signal in signals:
        if signal.composite_score < threshold:
            continue
        rationale = explain_signal(signal, config=config)
        reports.append(SignalReport(signal=signal, rationale=rationale))
    return reports
