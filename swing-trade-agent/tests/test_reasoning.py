"""Tests for the LLM reasoning (narration) layer.

The Anthropic client is fully mocked via a fake `anthropic` module — no test
makes a real API call. Covers: the prompt is well-formed and passes the right
model/params, threshold filtering in the batch entrypoint, and the fallback
path on API error / missing key.
"""

from __future__ import annotations

import sys
import types

import pytest

from app.config import Config
from app.output.models import SignalReport
from app.reasoning import (
    build_prompt,
    explain_signal,
    explain_signals,
    fallback_rationale,
)
from app.signals.models import RuleResult, Signal


def _signal(symbol="AMZN", score=0.72) -> Signal:
    return Signal(
        symbol=symbol,
        direction="long",
        composite_score=score,
        triggered_rules=[RuleResult("oversold_bounce", True, score, "detail")],
        key_levels={"close": 111.0, "sma_200": 100.0},
        suggested_stop=107.0,
        atr=2.0,
        as_of="2026-07-24",
    )


# --- a fake anthropic SDK --------------------------------------------------


class _Rec:
    """Records the create() kwargs and controls the mocked behaviour."""

    calls: list = []
    reply: str = "1. Setup ... 2. Invalidation ... 3. Risk note ..."
    mode: str = "ok"  # "ok" | "raise" | "empty"


@pytest.fixture
def fake_anthropic(monkeypatch):
    _Rec.calls = []
    _Rec.mode = "ok"
    _Rec.reply = "1. Setup ... 2. Invalidation ... 3. Risk note ..."

    class _Messages:
        def create(self, **kwargs):
            _Rec.calls.append(kwargs)
            if _Rec.mode == "raise":
                raise RuntimeError("api down")
            text = "" if _Rec.mode == "empty" else _Rec.reply
            return types.SimpleNamespace(
                content=[types.SimpleNamespace(type="text", text=text)]
            )

    class Anthropic:
        def __init__(self, api_key=None):
            self.api_key = api_key
            self.messages = _Messages()

    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=Anthropic))
    return _Rec


# --- prompt shape ----------------------------------------------------------


def test_build_prompt_contains_only_provided_numbers():
    prompt = build_prompt(_signal())
    assert "0.72" in prompt
    assert "AMZN" in prompt
    assert "ONLY these numbers" in prompt


def test_system_prompt_forbids_inventing_data():
    from app.reasoning.claude import SYSTEM_PROMPT

    lowered = SYSTEM_PROMPT.lower()
    assert "only" in lowered
    assert "never invent" in lowered
    assert "price target" in lowered  # explicitly forbidden
    assert "thin" in lowered  # instructed to say so rather than embellish


# --- the mocked Anthropic call --------------------------------------------


def test_explain_signal_calls_anthropic_and_returns_text(fake_anthropic):
    cfg = Config(anthropic_api_key="sk-test")
    out = explain_signal(_signal(), config=cfg)

    assert out == fake_anthropic.reply
    assert len(fake_anthropic.calls) == 1


def test_request_is_well_formed(fake_anthropic):
    cfg = Config(anthropic_api_key="sk-test")  # llm_model defaults to claude-opus-4-8
    explain_signal(_signal(), config=cfg)

    kwargs = fake_anthropic.calls[0]
    # The user-specified model and a low, deterministic effort.
    assert kwargs["model"] == "claude-opus-4-8"
    assert kwargs["output_config"] == {"effort": "low"}
    # temperature is REMOVED on opus-4-8 (would 400) — must not be sent.
    assert "temperature" not in kwargs
    # System prompt carries the narration-only guardrails.
    assert "never invent" in kwargs["system"].lower()
    # The user message is exactly the structured signal JSON.
    content = kwargs["messages"][0]["content"]
    assert "0.72" in content
    assert "AMZN" in content


# --- fallback paths --------------------------------------------------------


def test_fallback_when_no_api_key():
    out = explain_signal(_signal(), config=Config(anthropic_api_key=None))
    assert "AMZN" in out  # deterministic template, no network


def test_fallback_on_api_error(fake_anthropic):
    fake_anthropic.mode = "raise"
    cfg = Config(anthropic_api_key="sk-test")
    out = explain_signal(_signal(), config=cfg)
    assert "AMZN" in out  # did not crash; fell back to the template
    assert fake_anthropic.calls  # the call was attempted


def test_fallback_on_empty_response(fake_anthropic):
    fake_anthropic.mode = "empty"
    cfg = Config(anthropic_api_key="sk-test")
    out = explain_signal(_signal(), config=cfg)
    assert "AMZN" in out


def test_no_fallback_raises_when_disabled():
    from app.reasoning import ReasoningError

    with pytest.raises(ReasoningError):
        explain_signal(_signal(), config=Config(anthropic_api_key=None), allow_fallback=False)


def test_fallback_rationale_mentions_key_facts():
    text = fallback_rationale(_signal())
    assert "AMZN" in text
    assert "oversold_bounce" in text
    assert "107.0" in text or "107.00" in text
    assert "not a trade instruction" in text.lower()


# --- batch + threshold -----------------------------------------------------


def test_explain_signals_filters_by_threshold():
    signals = [_signal("HIGH", 0.80), _signal("MID", 0.50), _signal("LOW", 0.10)]
    cfg = Config(anthropic_api_key=None)  # fallback narration, no network

    reports = explain_signals(signals, threshold=0.5, config=cfg)

    assert [r.signal.symbol for r in reports] == ["HIGH", "MID"]  # LOW dropped
    assert all(isinstance(r, SignalReport) for r in reports)
    assert all(r.rationale for r in reports)


def test_explain_signals_defaults_to_config_threshold():
    signals = [_signal("A", 0.45), _signal("B", 0.35)]
    cfg = Config(anthropic_api_key=None, signal_threshold=0.40)
    reports = explain_signals(signals, config=cfg)  # threshold=None -> config
    assert [r.signal.symbol for r in reports] == ["A"]


def test_explain_signals_below_threshold_makes_no_llm_call(fake_anthropic):
    cfg = Config(anthropic_api_key="sk-test", signal_threshold=0.9)
    reports = explain_signals([_signal("X", 0.2)], config=cfg)
    assert reports == []
    assert fake_anthropic.calls == []  # nothing crossed the threshold -> no cost
