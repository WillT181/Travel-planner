"""Interactive tool-using agent — chat with the pipeline in the terminal.

``python -m app.agent`` starts a REPL. The agent (claude-opus-4-8) can call a
handful of tools that are THIN wrappers over the existing modules — it never
reimplements any signal logic, and it never places trades. Every tool returns a
string (JSON or plain text) to the model; a tool error becomes a clear error
string rather than crashing the loop.

The conversation loop is the standard Anthropic tool-use pattern: send the
history + tool definitions, execute any ``tool_use`` blocks, append the matching
``tool_result`` blocks, and re-call until the model returns plain text. The
message history persists across turns so it's genuinely conversational.
"""

from __future__ import annotations

import json
import sys

from app.config import Config, load_config

DEFAULT_MODEL = "claude-opus-4-8"
MAX_TOKENS = 1024
MAX_TOOL_STEPS = 12  # safety cap on tool round-trips within a single user turn

SYSTEM_PROMPT = (
    "You are a decision-support agent for the user's personal stock portfolio. "
    "You surface and explain technical swing-trading signals so the user can "
    "review them.\n\n"
    "Hard rules:\n"
    "- Reason ONLY from data returned by your tools. NEVER invent prices, "
    "indicator values, price targets, dates, news, or fundamentals. If a tool "
    "returns an error or thin data, say so plainly.\n"
    "- Use the tools to answer questions about holdings, signals, price history, "
    "and backtests; cite the actual numbers the tools give you.\n"
    "- You have MEMORY of past runs (stored day to day). Use `get_signal_history` "
    "and `get_recent_changes` to add temporal context — for example, note when a "
    "setup has persisted several days without resolving, when a rule keeps firing "
    "and failing, or when today differs from recent history. Still reason ONLY "
    "from what the tools return.\n"
    "- You are SCREENING-ONLY. You do NOT place, modify, or cancel trades, and "
    "you do NOT give financial advice. If asked to trade or for advice on what "
    "to buy/sell, decline and explain that you only screen and explain signals.\n"
    "- Be concise and specific."
)


# ---------------------------------------------------------------------------
# Lazy shared context (config + price provider), built once per process.
# ---------------------------------------------------------------------------

_CTX: dict = {}


def _context():
    if "config" not in _CTX:
        from app.prices import get_price_provider

        cfg = load_config()
        _CTX["config"] = cfg
        _CTX["provider"] = get_price_provider(cfg)
    return _CTX["config"], _CTX["provider"]


# ---------------------------------------------------------------------------
# Tools — thin wrappers over existing modules. Each returns JSON-able data or a
# string; dispatch_tool serialises and handles errors.
# ---------------------------------------------------------------------------


def tool_get_portfolio() -> list[dict]:
    """Current Trading 212 holdings."""
    from app.portfolio import fetch_positions

    cfg, _ = _context()
    positions = fetch_positions(config=cfg)
    return [
        {
            "symbol": p.ticker,
            "quantity": p.quantity,
            "avg_price": p.avg_price,
            "t212_ticker": p.raw_ticker,
        }
        for p in positions
    ]


def tool_get_price_history(symbol: str, days: int = 60) -> dict:
    """Recent daily OHLCV summary for one symbol."""
    cfg, provider = _context()
    df = provider.get_history(symbol, lookback_days=int(days))
    tail = df.tail(int(days))
    recent = df.tail(10)
    last = df.iloc[-1]
    return {
        "symbol": symbol,
        "bars_available": int(len(df)),
        "as_of": str(df.index[-1].date()),
        "latest_close": round(float(last["close"]), 4),
        "window_days": int(days),
        "window_high": round(float(tail["high"].max()), 4),
        "window_low": round(float(tail["low"].min()), 4),
        "recent_bars": [
            {
                "date": str(idx.date()),
                "open": round(float(row["open"]), 4),
                "high": round(float(row["high"]), 4),
                "low": round(float(row["low"]), 4),
                "close": round(float(row["close"]), 4),
                "volume": int(row["volume"]),
            }
            for idx, row in recent.iterrows()
        ],
    }


def tool_explain_signal(symbol: str) -> dict:
    """Full structured signal + plain-English rationale for one symbol."""
    from app.reasoning import explain_signal
    from app.signals import signal_from_ohlcv

    cfg, provider = _context()
    df = provider.get_history(symbol, lookback_days=cfg.history_days)
    signal = signal_from_ohlcv(symbol, df)
    rationale = explain_signal(signal, config=cfg)
    return {**signal.to_dict(), "rationale": rationale}


def tool_get_signals(symbol: str | None = None) -> dict:
    """Today's signal reports (from Supabase), falling back to live evaluation."""
    from app.output import SignalReport, read_todays_signals
    from app.portfolio import fetch_positions
    from app.reasoning import explain_signal, explain_signals
    from app.signals import signal_from_ohlcv

    cfg, provider = _context()

    rows = read_todays_signals(config=cfg, symbol=symbol)
    if rows:
        return {"source": "supabase", "signals": rows}

    # Live fallback.
    if symbol:
        df = provider.get_history(symbol, lookback_days=cfg.history_days)
        sig = signal_from_ohlcv(symbol, df)
        report = SignalReport(signal=sig, rationale=explain_signal(sig, config=cfg))
        return {"source": "live", "signals": [report.to_row()]}

    symbols = [p.ticker for p in fetch_positions(config=cfg) if p.quantity > 0]
    signals = []
    for sym in symbols:
        try:
            signals.append(
                signal_from_ohlcv(sym, provider.get_history(sym, lookback_days=cfg.history_days))
            )
        except Exception:  # noqa: BLE001 - skip a bad symbol, keep the rest
            continue
    reports = explain_signals(signals, threshold=cfg.signal_threshold, config=cfg)
    return {"source": "live", "signals": [r.to_row() for r in reports]}


def tool_run_backtest(rule: str | None = None) -> str:
    """Backtest summary over the portfolio (all rules, or one)."""
    from app.backtest import format_report, run_backtest
    from app.portfolio import fetch_positions

    cfg, provider = _context()
    symbols = [p.ticker for p in fetch_positions(config=cfg) if p.quantity > 0]
    price_data = {}
    for sym in symbols:
        try:
            price_data[sym] = provider.get_history(sym, lookback_days=max(cfg.history_days, 400))
        except Exception:  # noqa: BLE001
            continue
    if not price_data:
        return "No price data available to backtest."

    report = run_backtest(price_data)
    if rule:
        if rule not in report.rules:
            return f"Unknown rule '{rule}'. Available: {', '.join(report.rules)}."
        report.rules = {rule: report.rules[rule]}  # keep only the requested rule
    return format_report(report)


def tool_get_signal_history(symbol: str, days: int = 30) -> dict:
    """One symbol's past signal reports from memory, oldest first."""
    from app.memory import fetch_timeline

    cfg, _ = _context()
    timeline = fetch_timeline(symbol, days=int(days), config=cfg)
    return {"symbol": symbol, "days": int(days), "count": len(timeline), "timeline": timeline}


def tool_get_recent_changes() -> dict:
    """Diff the latest run vs the previous one (new / newly-triggered / stopped)."""
    from app.memory import diff_runs

    cfg, _ = _context()
    return diff_runs(config=cfg)


# Registry: name -> callable. dispatch_tool looks up here so tests can inject.
TOOL_FUNCS = {
    "get_portfolio": tool_get_portfolio,
    "get_signals": tool_get_signals,
    "explain_signal": tool_explain_signal,
    "get_price_history": tool_get_price_history,
    "run_backtest": tool_run_backtest,
    "get_signal_history": tool_get_signal_history,
    "get_recent_changes": tool_get_recent_changes,
}

# Anthropic tool-use definitions (name / description / JSON input schema).
_RULE_NAMES = [
    "oversold_bounce",
    "golden_cross_momentum",
    "macd_bullish_crossover",
    "bollinger_mean_reversion",
    "ema_pullback_resume",
]

TOOL_DEFS = [
    {
        "name": "get_portfolio",
        "description": "Get the user's current Trading 212 holdings (symbol, quantity, average price). Read-only.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_signals",
        "description": (
            "Get today's swing-trade signal reports for the whole portfolio, or "
            "for one symbol if `symbol` is given. Reads the stored signals table "
            "and falls back to live evaluation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Optional clean symbol, e.g. AAPL"}
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "explain_signal",
        "description": "Get the full structured signal and a plain-English rationale for one symbol.",
        "input_schema": {
            "type": "object",
            "properties": {"symbol": {"type": "string", "description": "Clean symbol, e.g. AAPL"}},
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_price_history",
        "description": "Get a recent daily OHLCV summary (latest close, window high/low, last ~10 bars) for one symbol.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Clean symbol, e.g. AAPL"},
                "days": {"type": "integer", "description": "Lookback window in trading days (default 60)"},
            },
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "run_backtest",
        "description": "Run the walk-forward backtest over the portfolio and return the per-rule summary vs buy-and-hold. Optionally restrict to one rule.",
        "input_schema": {
            "type": "object",
            "properties": {
                "rule": {"type": "string", "enum": _RULE_NAMES, "description": "Optional single rule to report"}
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_signal_history",
        "description": (
            "Memory: get a symbol's PAST signal reports over the last `days` "
            "(default 30), oldest first, so you can see how a setup has evolved "
            "over time."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Clean symbol, e.g. AAPL"},
                "days": {"type": "integer", "description": "Lookback window in days (default 30)"},
            },
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_recent_changes",
        "description": (
            "Memory: compare the latest run to the previous one and return what's "
            "new (symbols), newly triggered (symbol+rule), and what stopped "
            "triggering since the last run."
        ),
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
]


# ---------------------------------------------------------------------------
# Tool dispatch + conversation loop (pure, testable functions).
# ---------------------------------------------------------------------------


def dispatch_tool(name: str, tool_input: dict, tool_funcs: dict | None = None) -> str:
    """Execute one tool by name; always returns a string (errors included)."""
    funcs = TOOL_FUNCS if tool_funcs is None else tool_funcs
    fn = funcs.get(name)
    if fn is None:
        return f"Error: unknown tool '{name}'."
    try:
        result = fn(**(tool_input or {}))
    except TypeError as exc:
        return f"Error: bad arguments for {name}: {exc}"
    except Exception as exc:  # noqa: BLE001 - a tool error must not crash the loop
        return f"Error running {name}: {exc}"
    if isinstance(result, str):
        return result
    try:
        return json.dumps(result, default=str)
    except Exception:  # pragma: no cover - defensive
        return str(result)


def _extract_text(message) -> str:
    parts = [
        block.text
        for block in getattr(message, "content", [])
        if getattr(block, "type", None) == "text"
    ]
    return "".join(parts).strip()


def run_turn(
    client,
    messages: list,
    user_text: str,
    tools: list | None = None,
    tool_funcs: dict | None = None,
    system: str = SYSTEM_PROMPT,
    model: str = DEFAULT_MODEL,
    max_tokens: int = MAX_TOKENS,
) -> str:
    """Run one user turn to completion, mutating ``messages`` in place.

    Appends the user message, then loops the Anthropic tool-use cycle: call the
    model, execute any tool_use blocks, append their tool_result blocks, and
    re-call until the model stops requesting tools. Returns the final text.
    (No ``temperature`` — claude-opus-4-8 rejects sampling parameters.)
    """
    tools = TOOL_DEFS if tools is None else tools
    messages.append({"role": "user", "content": user_text})

    for _ in range(MAX_TOOL_STEPS):
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            tools=tools,
            messages=messages,
        )
        # Preserve the assistant turn verbatim (tool_use blocks included).
        messages.append({"role": "assistant", "content": response.content})

        if getattr(response, "stop_reason", None) != "tool_use":
            return _extract_text(response)

        tool_results = []
        for block in response.content:
            if getattr(block, "type", None) == "tool_use":
                content = dispatch_tool(block.name, dict(block.input or {}), tool_funcs=tool_funcs)
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": block.id, "content": content}
                )
        messages.append({"role": "user", "content": tool_results})

    return "(stopped: too many tool calls in one turn)"


# ---------------------------------------------------------------------------
# REPL
# ---------------------------------------------------------------------------

_BANNER = (
    "Swing Trade Signal Agent — decision support only (no trading).\n"
    "Ask about your holdings, today's signals, a symbol's rationale, price "
    "history, or a backtest. Type 'exit' to quit.\n"
)


def main(argv: list[str] | None = None) -> int:  # pragma: no cover - interactive
    config: Config = load_config()
    if not config.anthropic_api_key:
        print("ANTHROPIC_API_KEY is not set — the agent needs it to chat.", file=sys.stderr)
        return 1
    try:
        import anthropic
    except ImportError:
        print("The `anthropic` package is required: pip install .[reasoning]", file=sys.stderr)
        return 1

    client = anthropic.Anthropic(api_key=config.anthropic_api_key)
    messages: list = []
    print(_BANNER)

    while True:
        try:
            user_text = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if user_text.lower() in {"exit", "quit"}:
            break
        if not user_text:
            continue
        try:
            reply = run_turn(client, messages, user_text, model=config.llm_model)
        except Exception as exc:  # noqa: BLE001 - keep the REPL alive on any error
            print(f"[error] {exc}\n", file=sys.stderr)
            continue
        print(f"\nagent> {reply}\n")

    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
