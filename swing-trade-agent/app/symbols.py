"""Single source of truth for "which symbols are we screening?".

Every portfolio-wide entry point (pipeline, backtest CLI, agent tools) used to
call ``fetch_positions`` directly, which made Trading 212 credentials a hard
requirement: with no broker key there were no symbols, so signals, the
backtest, and the daily briefing were all silently empty.

Resolution order — first match wins:

1. an explicit ``symbols`` argument (CLI ``--symbols``, a tool argument),
2. the Trading 212 portfolio, when ``T212_API_KEY`` is configured,
3. the ``WATCHLIST`` env var — the no-broker-account path.

The resolved set carries its ``source`` so callers (and the agent's narration)
can say where the symbols came from rather than implying they are holdings.
This module reads data only; nothing here can place a trade.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.config import Config, load_config

logger = logging.getLogger(__name__)

# Source labels — also shown to the user, so keep them plain English.
SOURCE_EXPLICIT = "explicit list"
SOURCE_PORTFOLIO = "Trading 212 portfolio"
SOURCE_WATCHLIST = "watchlist"


class SymbolSourceError(RuntimeError):
    """No symbols could be resolved from any source."""


@dataclass(frozen=True)
class SymbolSet:
    """Resolved symbols plus where they came from."""

    symbols: list[str]
    source: str

    def __len__(self) -> int:  # convenience for callers that just want a count
        return len(self.symbols)

    def __iter__(self):
        return iter(self.symbols)


def _clean(symbols) -> list[str]:
    """Upper-case, strip, and de-duplicate while preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for raw in symbols or []:
        sym = str(raw).strip().upper()
        if sym and sym not in seen:
            seen.add(sym)
            out.append(sym)
    return out


def resolve_symbols(
    config: Config | None = None,
    symbols: list[str] | None = None,
) -> SymbolSet:
    """Resolve the symbol universe to screen.

    Falls back to the watchlist when Trading 212 is unconfigured, returns no
    open positions, or is unreachable — so a broker outage degrades to the
    watchlist instead of producing an empty run. A Trading 212 failure with no
    watchlist configured still raises, rather than silently screening nothing.
    """
    config = config or load_config()

    explicit = _clean(symbols)
    if explicit:
        return SymbolSet(explicit, SOURCE_EXPLICIT)

    watchlist = _clean(config.watchlist)

    if config.t212_api_key:
        try:
            from app.portfolio import fetch_positions

            held = _clean(p.ticker for p in fetch_positions(config=config) if p.quantity > 0)
            if held:
                return SymbolSet(held, SOURCE_PORTFOLIO)
            logger.warning(
                "Trading 212 returned no open positions; falling back to WATCHLIST."
            )
        except Exception as exc:  # noqa: BLE001 - broker down must not kill the run
            if not watchlist:
                raise
            logger.warning(
                "Trading 212 unavailable (%s); falling back to WATCHLIST.", exc
            )

    if watchlist:
        return SymbolSet(watchlist, SOURCE_WATCHLIST)

    raise SymbolSourceError(
        "No symbols to screen. Set WATCHLIST in .env (e.g. "
        "WATCHLIST=AAPL,MSFT,NVDA), configure a READ-ONLY T212_API_KEY, or "
        "pass symbols explicitly."
    )
