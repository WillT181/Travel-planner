"""Tests for the interactive agent loop.

The Anthropic client and the tool functions are mocked — no network, no real
LLM. Verifies: a tool_use response triggers the right function, the tool_result
is fed back and the model is re-called, tool errors become strings (loop never
crashes), plain-text responses end the turn, and history persists across turns.
"""

from __future__ import annotations

from types import SimpleNamespace as NS

from app.agent import (
    TOOL_DEFS,
    TOOL_FUNCS,
    dispatch_tool,
    run_turn,
)


# --- fakes -----------------------------------------------------------------


class _FakeClient:
    """Returns queued responses in order; snapshots message roles per call."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []  # list of role-snapshots, one per create()
        self.messages = self  # so client.messages.create works

    def create(self, **kwargs):
        self.calls.append([m["role"] for m in kwargs["messages"]])
        return self.responses.pop(0)


def _text(text):
    return NS(stop_reason="end_turn", content=[NS(type="text", text=text)])


def _tool_use(tool_id, name, tool_input):
    return NS(
        stop_reason="tool_use",
        content=[NS(type="tool_use", id=tool_id, name=name, input=tool_input)],
    )


# --- registry / tool defs --------------------------------------------------


def test_tool_defs_match_registry_and_are_well_formed():
    names = {t["name"] for t in TOOL_DEFS}
    assert names == set(TOOL_FUNCS)
    assert names == {
        "get_portfolio",
        "get_signals",
        "explain_signal",
        "get_price_history",
        "run_backtest",
        "get_signal_history",
        "get_recent_changes",
    }
    for t in TOOL_DEFS:
        assert isinstance(t["description"], str) and t["description"]
        assert t["input_schema"]["type"] == "object"


# --- dispatch_tool ---------------------------------------------------------


def test_dispatch_serialises_dict_result():
    out = dispatch_tool("x", {}, tool_funcs={"x": lambda: {"a": 1}})
    assert '"a": 1' in out


def test_dispatch_passes_arguments():
    seen = {}

    def spy(**kw):
        seen.update(kw)
        return "ok"

    out = dispatch_tool("get_price_history", {"symbol": "AAPL", "days": 30}, tool_funcs={"get_price_history": spy})
    assert out == "ok"
    assert seen == {"symbol": "AAPL", "days": 30}


def test_dispatch_unknown_tool_returns_error():
    assert "unknown tool" in dispatch_tool("nope", {}, tool_funcs={})


def test_dispatch_catches_tool_exception():
    def boom(**kw):
        raise RuntimeError("kaboom")

    out = dispatch_tool("boom", {}, tool_funcs={"boom": boom})
    assert out.startswith("Error running boom")
    assert "kaboom" in out


# --- run_turn (the loop) ---------------------------------------------------


def test_run_turn_executes_tool_and_feeds_result_back():
    called = {}

    def fake_get_portfolio(**kw):
        called["args"] = kw
        return [{"symbol": "AAPL", "quantity": 5, "avg_price": 150.0}]

    client = _FakeClient(
        [
            _tool_use("toolu_1", "get_portfolio", {}),
            _text("You hold 5 shares of AAPL."),
        ]
    )
    messages: list = []
    reply = run_turn(
        client, messages, "what do I hold?",
        tools=[], tool_funcs={"get_portfolio": fake_get_portfolio},
    )

    # The right function ran, with the model-supplied (empty) input.
    assert called["args"] == {}
    # The model was re-called after the tool result, and returned plain text.
    assert reply == "You hold 5 shares of AAPL."
    assert len(client.calls) == 2

    # History order: user -> assistant(tool_use) -> user(tool_result) -> assistant(text)
    assert [m["role"] for m in messages] == ["user", "assistant", "user", "assistant"]
    tool_result_msg = messages[2]
    block = tool_result_msg["content"][0]
    assert block["type"] == "tool_result"
    assert block["tool_use_id"] == "toolu_1"          # matched back to the call
    assert "AAPL" in block["content"]                  # the tool's result was fed back

    # The SECOND model call saw the tool_result appended (proves the round-trip).
    assert client.calls[0] == ["user"]
    assert client.calls[1] == ["user", "assistant", "user"]


def test_run_turn_plain_text_ends_immediately():
    client = _FakeClient([_text("Hi — I only screen and explain signals.")])
    messages: list = []
    reply = run_turn(client, messages, "hello", tools=[], tool_funcs={})
    assert reply == "Hi — I only screen and explain signals."
    assert len(client.calls) == 1
    assert messages[0] == {"role": "user", "content": "hello"}


def test_run_turn_survives_tool_error():
    def boom(**kw):
        raise RuntimeError("provider down")

    client = _FakeClient(
        [
            _tool_use("toolu_9", "get_signals", {"symbol": "AAPL"}),
            _text("I couldn't fetch that right now."),
        ]
    )
    messages: list = []
    reply = run_turn(client, messages, "signals for AAPL?", tools=[], tool_funcs={"get_signals": boom})

    assert reply == "I couldn't fetch that right now."  # loop did not crash
    fed_back = messages[2]["content"][0]["content"]
    assert "Error running get_signals" in fed_back  # error surfaced to the model


def test_get_signal_history_dispatches_in_loop():
    seen = {}

    def spy(**kw):
        seen.update(kw)
        return {"symbol": kw["symbol"], "count": 0, "timeline": []}

    client = _FakeClient(
        [
            _tool_use("t1", "get_signal_history", {"symbol": "AAPL", "days": 14}),
            _text("No prior signals for AAPL in that window."),
        ]
    )
    messages: list = []
    reply = run_turn(
        client, messages, "how has AAPL evolved?",
        tools=[], tool_funcs={"get_signal_history": spy},
    )
    assert seen == {"symbol": "AAPL", "days": 14}  # right function + args
    assert reply == "No prior signals for AAPL in that window."
    assert messages[2]["content"][0]["tool_use_id"] == "t1"  # result fed back


def test_get_recent_changes_dispatches_in_loop():
    calls = {"n": 0}

    def spy(**kw):
        calls["n"] += 1
        return {"new_symbols": ["NVDA"], "newly_triggered": [], "stopped_triggering": []}

    client = _FakeClient(
        [
            _tool_use("t2", "get_recent_changes", {}),
            _text("NVDA is newly flagged vs the previous run."),
        ]
    )
    messages: list = []
    reply = run_turn(
        client, messages, "what changed today?",
        tools=[], tool_funcs={"get_recent_changes": spy},
    )
    assert calls["n"] == 1
    assert "NVDA" in messages[2]["content"][0]["content"]  # diff fed back to model
    assert reply == "NVDA is newly flagged vs the previous run."


def test_history_persists_across_turns():
    client = _FakeClient([_text("first"), _text("second")])
    messages: list = []
    run_turn(client, messages, "one", tools=[], tool_funcs={})
    run_turn(client, messages, "two", tools=[], tool_funcs={})
    roles = [m["role"] for m in messages]
    # two user turns + two assistant replies, all retained
    assert roles == ["user", "assistant", "user", "assistant"]
    # the second model call included the first exchange in its history
    assert client.calls[1] == ["user", "assistant", "user"]
