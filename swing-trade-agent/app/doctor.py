"""Setup diagnostics — ``python -m app.run doctor``.

Almost every stage of this app degrades gracefully when something is
unconfigured, which is right for reliability but means a *setup* mistake shows
up as bland empty output ("no signals", "quiet day") rather than an error. This
module inspects each dependency and reports its state with a specific fix, so a
misconfiguration is visible in one command instead of being deduced.

Read-only: it never writes, sends, or calls a paid API.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import ENV_FILE, Config, load_config

OK = "ok"
WARN = "warn"
FAIL = "fail"

_MARK = {OK: "PASS", WARN: "OPTIONAL", FAIL: "FAIL"}


@dataclass(frozen=True)
class Check:
    name: str
    status: str
    detail: str
    fix: str = ""

    @property
    def required(self) -> bool:
        return self.status == FAIL


def _check_env_file() -> Check:
    if ENV_FILE.exists():
        return Check(".env file", OK, str(ENV_FILE))
    return Check(
        ".env file",
        FAIL,
        f"Not found at {ENV_FILE}",
        "cp .env.example .env",
    )


def _check_anthropic(config: Config) -> Check:
    key = config.anthropic_api_key or ""
    if not key:
        return Check(
            "Anthropic API key",
            FAIL,
            "Not set — chatting returns 'not configured on the server'.",
            "bash scripts/set-key.sh",
        )
    if not key.startswith("sk-ant-"):
        return Check(
            "Anthropic API key",
            FAIL,
            f"Set, but does not look like an Anthropic key (length {len(key)}).",
            "bash scripts/set-key.sh",
        )
    # ~108 chars is normal; a doubled paste is a real failure we have seen.
    if len(key) > 150:
        return Check(
            "Anthropic API key",
            WARN,
            f"Set, but unusually long ({len(key)} chars) — possibly pasted twice.",
            "bash scripts/set-key.sh  (paste once)",
        )
    return Check("Anthropic API key", OK, f"Set (length {len(key)}).")


def _check_symbols(config: Config) -> Check:
    from app.symbols import SOURCE_WATCHLIST, SymbolSourceError, resolve_symbols

    try:
        universe = resolve_symbols(config)
    except SymbolSourceError as exc:
        return Check("Symbols to screen", FAIL, "None resolved.", str(exc))
    except Exception as exc:  # noqa: BLE001 - broker error with no watchlist
        return Check(
            "Symbols to screen",
            FAIL,
            f"Broker lookup failed: {exc}",
            "Set WATCHLIST in .env so screening works without Trading 212.",
        )
    listed = ", ".join(universe.symbols[:8])
    more = "" if len(universe.symbols) <= 8 else f" (+{len(universe.symbols) - 8} more)"
    detail = f"{len(universe.symbols)} from {universe.source}: {listed}{more}"
    if universe.source == SOURCE_WATCHLIST and config.t212_api_key:
        return Check(
            "Symbols to screen",
            WARN,
            detail + " — Trading 212 is configured but returned nothing.",
            "Check the key, or ignore if you meant to screen the watchlist.",
        )
    return Check("Symbols to screen", OK, detail)


def _check_prices(config: Config) -> Check:
    try:
        import yfinance  # noqa: F401
    except ImportError:
        return Check(
            "Price data",
            FAIL,
            "yfinance is not installed — no prices means no signals.",
            'pip install -e ".[prices]"',
        )
    return Check("Price data", OK, f"provider={config.price_provider}")


def _check_supabase(config: Config) -> Check:
    from app.output.supabase_writer import check_supabase

    result = check_supabase(config)
    if result["ok"]:
        return Check("Memory (Supabase)", OK, result["detail"], result["fix"])
    # Optional: without it the app runs, but has no history or daily briefing.
    return Check(
        "Memory (Supabase)",
        WARN,
        result["detail"] + " Signal history and the daily briefing stay empty.",
        result["fix"],
    )


def _check_trading212(config: Config) -> Check:
    if not config.t212_api_key:
        return Check(
            "Trading 212",
            WARN,
            "Not connected — screening uses your watchlist instead.",
            "Optional. Use a DEMO account and a READ-ONLY key when you add it.",
        )
    if not config.is_demo:
        return Check(
            "Trading 212",
            WARN,
            f"Configured against a NON-DEMO host: {config.t212_base_url}",
            "The app only ever reads, but demo is the safer default.",
        )
    return Check("Trading 212", OK, f"Configured (demo host, read-only usage).")


def _check_news(config: Config) -> Check:
    if not config.news_api_key:
        return Check(
            "News / events",
            WARN,
            "No key — get_news and get_upcoming_events return 'no data'.",
            "Optional. Free key at https://finnhub.io, then set NEWS_API_KEY.",
        )
    return Check("News / events", OK, f"provider={config.news_provider}")


def _check_email(config: Config) -> Check:
    if not config.resend_api_key:
        return Check("Email digest", WARN, "No RESEND_API_KEY — digests print to stdout.", "Optional.")
    if not config.digest_to:
        return Check("Email digest", WARN, "RESEND_API_KEY set but DIGEST_TO is empty.", "Set DIGEST_TO in .env.")
    return Check("Email digest", OK, f"Sending to {config.digest_to}")


def run_checks(config: Config | None = None) -> list[Check]:
    """Run every diagnostic. Never raises — a broken check becomes a FAIL row."""
    config = config or load_config()
    checks: list[Check] = [_check_env_file()]
    for fn in (
        _check_anthropic,
        _check_symbols,
        _check_prices,
        _check_supabase,
        _check_trading212,
        _check_news,
        _check_email,
    ):
        try:
            checks.append(fn(config))
        except Exception as exc:  # noqa: BLE001 - a check must never crash the report
            checks.append(Check(fn.__name__, FAIL, f"Check itself failed: {exc}"))
    return checks


def format_checks(checks: list[Check]) -> str:
    width = max(len(c.name) for c in checks)
    lines = ["", "Swing Trade Signal Agent — setup check", "=" * 46]
    for c in checks:
        lines.append(f"[{_MARK[c.status]:>8}] {c.name.ljust(width)}  {c.detail}")
        if c.fix and c.status != OK:
            lines.append(f"{'':>11}{' ' * width}  -> {c.fix}")
    failures = [c for c in checks if c.status == FAIL]
    lines.append("=" * 46)
    if failures:
        lines.append(f"{len(failures)} blocking issue(s) — fix the -> lines above.")
    else:
        lines.append("No blocking issues. OPTIONAL items are safe to leave unset.")
    lines.append("")
    return "\n".join(lines)
