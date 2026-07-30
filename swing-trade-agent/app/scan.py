"""Full-universe scan — including the symbols that did NOT trigger.

The pipeline and the agent's signal tools filter to setups above the score
threshold. That is right for a digest, but it means a day with no triggers
produces no output at all, and the user cannot tell the difference between
"the screen ran and found nothing" and "something is broken". They also cannot
see which symbol is *closest* to firing.

Every rule already computes a ``detail`` string explaining its state even when
it does not trigger ("rsi 45.2->46.1, close 178.40 vs sma200 205.00"); the
signal engine keeps only triggered rules, so that diagnostic is discarded. This
module keeps it, so a scan can answer "why is nothing triggering?" with the
actual numbers.

Deterministic throughout: no LLM, no orders.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from app.config import Config, load_config
from app.prices.provider import PriceProvider
from app.symbols import resolve_symbols

logger = logging.getLogger(__name__)

# Rows this many or fewer carry their full per-rule diagnostics; beyond that
# only the leaders do, to keep an agent tool result from ballooning.
DETAIL_LIMIT = 5


@dataclass(frozen=True)
class ScanRow:
    """One symbol's screen result, triggered or not."""

    symbol: str
    composite_score: float = 0.0
    direction: str = "neutral"
    triggered_rules: list[str] = field(default_factory=list)
    close: float | None = None
    blockers: dict[str, str] = field(default_factory=dict)
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None

    def to_dict(self, include_blockers: bool = True) -> dict[str, Any]:
        data: dict[str, Any] = {
            "symbol": self.symbol,
            "composite_score": round(self.composite_score, 4),
            "direction": self.direction,
            "triggered_rules": self.triggered_rules,
            "close": self.close,
        }
        if self.error:
            data["error"] = self.error
        elif include_blockers and self.blockers:
            data["why_not_triggered"] = self.blockers
        return data


def scan_symbol(symbol: str, ohlcv) -> ScanRow:
    """Screen one symbol, keeping the reason each rule did not fire."""
    from app.indicators import add_indicators
    from app.signals.engine import build_signal, evaluate_rules

    indicator_df = add_indicators(ohlcv)
    # Both are pure functions of the same frame, so they cannot disagree.
    results = evaluate_rules(indicator_df)
    signal = build_signal(symbol, indicator_df)

    return ScanRow(
        symbol=symbol,
        composite_score=signal.composite_score,
        direction=signal.direction,
        triggered_rules=signal.triggered_rule_names,
        close=signal.key_levels.get("close"),
        blockers={r.name: r.detail for r in results if not r.triggered and r.detail},
    )


def scan_universe(
    config: Config | None = None,
    symbols: list[str] | None = None,
    provider: PriceProvider | None = None,
) -> list[ScanRow]:
    """Screen every symbol in the universe, ranked by score (highest first).

    Unlike the pipeline this applies **no threshold** — non-triggering symbols
    are returned too, each with the reasons its rules stayed quiet. A symbol
    that fails to fetch or evaluate becomes a row carrying its error rather
    than vanishing from the report.
    """
    config = config or load_config()
    universe = resolve_symbols(config, symbols)

    if provider is None:
        from app.prices import get_price_provider

        provider = get_price_provider(config)

    rows: list[ScanRow] = []
    for sym in universe.symbols:
        try:
            ohlcv = provider.get_history(sym, lookback_days=config.history_days)
            if len(ohlcv) < 210:
                rows.append(
                    ScanRow(
                        symbol=sym,
                        error=f"only {len(ohlcv)} rows of history (need 210 for SMA200)",
                    )
                )
                continue
            rows.append(scan_symbol(sym, ohlcv))
        except Exception as exc:  # noqa: BLE001 - one bad symbol must not abort the scan
            logger.warning("scan failed for %s: %s", sym, exc)
            rows.append(ScanRow(symbol=sym, error=str(exc)))

    rows.sort(key=lambda r: (r.composite_score, r.symbol), reverse=True)
    return rows


def format_scan(rows: list[ScanRow], threshold: float) -> str:
    """Human-readable scan table for the CLI."""
    if not rows:
        return "No symbols scanned."

    width = max(len(r.symbol) for r in rows)
    triggered = [r for r in rows if r.triggered_rules]
    lines = [
        "",
        f"Universe scan — {len(rows)} symbol(s), threshold {threshold:g}",
        "=" * 60,
    ]
    for r in rows:
        if not r.ok:
            lines.append(f"  {r.symbol.ljust(width)}  --    error: {r.error}")
            continue
        mark = "*" if r.composite_score >= threshold else " "
        rules = ", ".join(r.triggered_rules) or "nothing triggered"
        lines.append(f"{mark} {r.symbol.ljust(width)}  {r.composite_score:.2f}  {rules}")

    lines.append("=" * 60)
    if triggered:
        above = [r for r in triggered if r.composite_score >= threshold]
        lines.append(
            f"{len(triggered)} symbol(s) triggered, {len(above)} above threshold."
        )
    else:
        lines.append("Nothing triggered. This is normal — setups are meant to be rare.")
        best = next((r for r in rows if r.ok), None)
        if best is not None and best.blockers:
            lines.append(f"\nClosest look at {best.symbol}:")
            for rule, detail in best.blockers.items():
                lines.append(f"  - {rule}: {detail}")
    lines.append("")
    return "\n".join(lines)
