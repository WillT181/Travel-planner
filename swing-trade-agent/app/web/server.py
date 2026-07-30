"""FastAPI service exposing the agent loop over HTTP.

`POST /api/chat` accepts a message (+ a session handle) and runs the exact same
tool-using loop as the terminal REPL — `app.agent.run_turn` — server-side, then
returns the agent's text reply and the renderable conversation history. The full
message history (including tool_use/tool_result blocks) and every secret stay on
the server; the client only ever receives display text.

Run locally:  uvicorn app.web.server:app --reload --port 8000
"""

from __future__ import annotations

import logging
import re
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agent import run_turn
from app.config import load_config

logger = logging.getLogger(__name__)

# Belt-and-braces: never let a key fragment reach the browser in an error string.
_SECRET_RE = re.compile(r"sk-[A-Za-z0-9_\-]{8,}")

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


def _redact(text: str) -> str:
    return _SECRET_RE.sub("sk-***redacted***", text)


def _friendly_error(exc: Exception) -> tuple[int, str]:
    """Map an agent-loop failure to (status, actionable message).

    Without this the exception escaped to Starlette's default 500 handler,
    which replies with PLAIN TEXT "Internal Server Error". The browser proxy
    could not parse that as JSON, so the real cause was replaced by a generic
    "backend returned a non-JSON response" and the user had nothing to act on.
    """
    detail = _redact(str(exc)) or type(exc).__name__
    status = getattr(exc, "status_code", None)
    lowered = detail.lower()

    if status == 401 or "authentication" in lowered or "invalid x-api-key" in lowered:
        return 401, (
            "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in "
            "swing-trade-agent/.env — run `make check-key` (a valid key is ~108 "
            "characters; a doubled paste is a common cause), or set it again "
            "with `bash scripts/set-key.sh`."
        )
    if "credit balance" in lowered or "billing" in lowered:
        return 402, (
            "Your Anthropic account has insufficient credit. Add credit at "
            "console.anthropic.com → Billing, then try again."
        )
    if status == 404 or "not_found" in lowered or "does not exist" in lowered:
        return 502, (
            f"The model '{load_config().llm_model}' is not available to this API "
            "key. Set LLM_MODEL in .env to a model your account can use."
        )
    if status == 429 or "rate limit" in lowered or "overloaded" in lowered:
        return 429, "Anthropic is rate-limiting or overloaded. Wait a moment and try again."
    if isinstance(exc, ModuleNotFoundError):
        return 500, (
            f"A Python dependency is missing ({detail}). Install the backend "
            'extras: pip install -e ".[web,reasoning,prices,output,dev]"'
        )
    return 500, f"The agent failed: {type(exc).__name__}: {detail}"


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

    # Snapshot so a failed turn cannot leave half-written tool blocks behind and
    # poison every subsequent request in this session.
    messages_snapshot = list(session["messages"])
    session["display"].append({"role": "user", "content": req.message})
    try:
        reply = run_turn(
            _client(config.anthropic_api_key),
            session["messages"],  # server-held history, mutated in place
            req.message,
            model=config.llm_model,
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - surface a usable JSON error
        session["messages"] = messages_snapshot
        session["display"].pop()
        status, message = _friendly_error(exc)
        logger.exception("Agent turn failed")  # full traceback in the server log
        raise HTTPException(status_code=status, detail=message) from exc
    session["display"].append({"role": "agent", "content": reply})

    return ChatResponse(session_id=session_id, reply=reply, history=list(session["display"]))


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.web.server:app", host="127.0.0.1", port=8000, reload=True)
