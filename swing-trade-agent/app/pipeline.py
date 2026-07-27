"""End-to-end daily pipeline orchestration.

Flow: portfolio -> prices -> indicators -> signals -> (threshold) -> reasoning
-> output. Each stage is a separately-testable module; this file just wires
them together. No stage places a trade.
"""

from __future__ import annotations

import logging

from app.config import Config, load_config
from app.output.models import SignalReport
from app.prices import get_price_provider
from app.prices.provider import PriceProvider
from app.reasoning import explain_signals
from app.signals import Signal, signal_from_ohlcv

logger = logging.getLogger("swing_agent")


def _get_symbols(config: Config, symbols: list[str] | None) -> list[str]:
    if symbols:
        return symbols
    # Import lazily so the pipeline can run with an explicit symbol list even
    # when Trading 212 credentials are absent (e.g. local experimentation).
    from app.portfolio import fetch_positions

    positions = fetch_positions(config=config)
    return [p.ticker for p in positions if p.quantity > 0]


def generate_signals(
    config: Config,
    symbols: list[str],
    provider: PriceProvider,
) -> list[Signal]:
    """Fetch prices and compute a Signal per symbol."""
    signals: list[Signal] = []
    for sym in symbols:
        try:
            ohlcv = provider.get_history(sym, lookback_days=config.history_days)
        except Exception as exc:
            logger.warning("skipping %s: price fetch failed: %s", sym, exc)
            continue
        if len(ohlcv) < 210:
            logger.warning("skipping %s: only %d rows (<210)", sym, len(ohlcv))
            continue
        signals.append(signal_from_ohlcv(sym, ohlcv))
    return signals


def run_pipeline(
    config: Config | None = None,
    symbols: list[str] | None = None,
    use_cache: bool = True,
    write: bool = True,
) -> list[SignalReport]:
    """Run the full pipeline and return the reports above threshold.

    Parameters
    ----------
    symbols:
        Explicit symbol list; when omitted the Trading 212 portfolio is used.
    write:
        Persist to Supabase / send email when configured. Set False for dry runs.
    """
    config = config or load_config()
    logger.info(
        "starting pipeline (env=%s, threshold=%.2f)",
        "DEMO" if config.is_demo else "LIVE-READONLY",
        config.signal_threshold,
    )

    resolved = _get_symbols(config, symbols)
    logger.info("evaluating %d symbol(s)", len(resolved))

    provider = get_price_provider(config, use_cache=use_cache)
    signals = generate_signals(config, resolved, provider)

    # Threshold filtering + narration live together in the reasoning layer.
    reports = explain_signals(
        signals, threshold=config.signal_threshold, config=config
    )
    logger.info("%d of %d symbols crossed threshold", len(reports), len(signals))

    if write:
        from app.output import send_digest_email, write_signals

        written = write_signals(reports, config=config)
        if written:
            logger.info("wrote %d rows to Supabase", written)
        if send_digest_email(reports, config=config):
            logger.info("digest email sent")

    return reports
