"""FastAPI service exposing the agent loop over HTTP.

`POST /api/chat` accepts a message (+ a session handle) and runs the exact same
tool-using loop as the terminal REPL — `app.agent.run_turn` — server-side, then
returns the agent's text reply and the renderable conversation history. The full
message history (including tool_use/tool_result blocks) and every secret stay on
the server; the client only ever receives display text.

Run locally:  uvicorn app.web.server:app --reload --port 8000
"""

from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agent import run_turn
from app.config import load_config

DISCLAIMER = (
    "Decision support / screening only. Reasons only from tool data; does not "
    "place trades and does not give financial advice."
)

app = FastAPI(title="Swing Trade Signal Agent")

# The browser talks to this API (typically same-origin via the Next.js proxy).
# CORS is permissive for local dev; tighten allow_origins for a real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# In-memory session store: session_id -> {"messages": [...], "display": [...]}.
# `messages` is the authoritative history run_turn mutates (with tool blocks);
# `display` is the renderable user/agent text. Fine for a single-user local tool;
# swap for a shared store if you deploy multi-instance.
_SESSIONS: dict[str, dict] = {}
_CLIENT = None


def _client(api_key: str):
    global _CLIENT
    if _CLIENT is None:
        import anthropic

        _CLIENT = anthropic.Anthropic(api_key=api_key)
    return _CLIENT


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    history: list[dict]  # [{role: "user"|"agent", content: str}]


@app.get("/api/health")
def health() -> dict:
    cfg = load_config()
    # Booleans only — never echo the key values themselves.
    return {
        "ok": True,
        "model": cfg.llm_model,
        "environment": "demo" if cfg.is_demo else "live-readonly",
        "anthropic_configured": bool(cfg.anthropic_api_key),
        "disclaimer": DISCLAIMER,
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    config = load_config()
    if not config.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not configured on the server.",
        )

    session_id = req.session_id or uuid.uuid4().hex
    session = _SESSIONS.setdefault(session_id, {"messages": [], "display": []})

    session["display"].append({"role": "user", "content": req.message})
    reply = run_turn(
        _client(config.anthropic_api_key),
        session["messages"],  # server-held history, mutated in place
        req.message,
        model=config.llm_model,
    )
    session["display"].append({"role": "agent", "content": reply})

    return ChatResponse(session_id=session_id, reply=reply, history=list(session["display"]))


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.web.server:app", host="127.0.0.1", port=8000, reload=True)
