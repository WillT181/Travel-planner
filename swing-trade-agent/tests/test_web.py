"""Smoke test for the web API route (the agent loop is mocked).

Verifies request/response shape, that the route reuses run_turn, that history
persists across turns via the session handle, and — critically — that server
secrets are never leaked to the client.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.web import server

SECRET_ANTHROPIC = "sk-ant-SECRET-do-not-leak"
SECRET_T212 = "t212-SECRET-do-not-leak"


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    # Server-side secrets — none of these may appear in any response body.
    monkeypatch.setenv("ANTHROPIC_API_KEY", SECRET_ANTHROPIC)
    monkeypatch.setenv("T212_API_KEY", SECRET_T212)
    server._SESSIONS.clear()
    server._CLIENT = "sentinel-client"  # avoid constructing a real Anthropic client
    yield
    server._SESSIONS.clear()
    server._CLIENT = None


@pytest.fixture
def client():
    return TestClient(server.app)


def test_chat_runs_the_agent_loop_and_returns_shape(client, monkeypatch):
    captured = {}

    def fake_run_turn(anthropic_client, messages, user_text, **kwargs):
        captured["user_text"] = user_text
        captured["model"] = kwargs.get("model")
        messages.append({"role": "user", "content": user_text})  # loop mutates history
        return "You hold 5 AAPL. (screening only)"

    monkeypatch.setattr(server, "run_turn", fake_run_turn)

    resp = client.post("/api/chat", json={"message": "what do I hold?"})
    assert resp.status_code == 200
    body = resp.json()

    # Shape.
    assert set(body) == {"session_id", "reply", "history"}
    assert body["reply"].startswith("You hold 5 AAPL")
    assert body["history"] == [
        {"role": "user", "content": "what do I hold?"},
        {"role": "agent", "content": "You hold 5 AAPL. (screening only)"},
    ]
    # The route reused the real agent loop with the configured model.
    assert captured["user_text"] == "what do I hold?"
    assert captured["model"] == "claude-opus-4-8"


def test_history_persists_across_turns_via_session(client, monkeypatch):
    monkeypatch.setattr(server, "run_turn", lambda c, m, t, **k: f"echo: {t}")

    first = client.post("/api/chat", json={"message": "hello"}).json()
    sid = first["session_id"]
    second = client.post("/api/chat", json={"message": "again", "session_id": sid}).json()

    assert second["session_id"] == sid
    assert [h["content"] for h in second["history"]] == ["hello", "echo: hello", "again", "echo: again"]


def test_secrets_never_reach_the_client(client, monkeypatch):
    # Even if the agent text somehow contained a secret, assert on the wire body.
    monkeypatch.setattr(server, "run_turn", lambda c, m, t, **k: "here is your briefing")

    chat_body = client.post("/api/chat", json={"message": "briefing"}).text
    health_body = client.get("/api/health").text

    for secret in (SECRET_ANTHROPIC, SECRET_T212):
        assert secret not in chat_body
        assert secret not in health_body

    # Health exposes booleans/labels only, not key material.
    health = client.get("/api/health").json()
    assert health["anthropic_configured"] is True
    assert "key" not in str(health).lower() or "api_key" not in str(health).lower()


def test_chat_503_when_anthropic_key_missing(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    resp = client.post("/api/chat", json={"message": "hi"})
    assert resp.status_code == 503
