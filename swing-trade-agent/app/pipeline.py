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
    """Fetch prices and compute a Signal per symbol.

    Resilient: any failure on one symbol (price fetch, indicator computation,
    signal build) is logged and skipped so it can never abort the whole run.
    """
    signals: list[Signal] = []
    for sym in symbols:
        try:
            ohlcv = provider.get_history(sym, lookback_days=config.history_days)
            if len(ohlcv) < 210:
                logger.warning(
                    "skipping %s: only %d rows (<210 needed for SMA200)", sym, len(ohlcv)
                )
                continue
            signal = signal_from_ohlcv(sym, ohlcv)
            signals.append(signal)
            logger.debug("evaluated %s: score=%.2f", sym, signal.composite_score)
        except Exception as exc:  # noqa: BLE001 - one bad symbol must not abort the run
            logger.warning("skipping %s: %s", sym, exc)
            continue
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
        "=== Swing Trade Signal Agent — pipeline start (env=%s, threshold=%.2f) ===",
        "DEMO" if config.is_demo else "LIVE-READONLY",
        config.signal_threshold,
    )

    # Stage 1 — portfolio.
    resolved = _get_symbols(config, symbols)
    source = "explicit list" if symbols else "Trading 212 portfolio"
    logger.info(
        "[1/4] Portfolio (%s): %d symbol(s) — %s",
        source,
        len(resolved),
        ", ".join(resolved) or "(none)",
    )

    # Stage 2 — prices -> indicators -> signals (per-symbol resilient).
    logger.info("[2/4] Prices + indicators + signals: processing %d symbol(s)", len(resolved))
    provider = get_price_provider(config, use_cache=use_cache)
    signals = generate_signals(config, resolved, provider)
    logger.info("[2/4] Signals: computed %d of %d symbol(s)", len(signals), len(resolved))

    # Stage 3 — reasoning (threshold filter + narration).
    logger.info("[3/4] Reasoning: narrating signals >= %.2f", config.signal_threshold)
    reports = explain_signals(signals, threshold=config.signal_threshold, config=config)
    logger.info("[3/4] Reasoning: %d of %d crossed threshold", len(reports), len(signals))

    # Stage 4 — output (Supabase + optional email; both no-op when unconfigured).
    logger.info("[4/4] Output: persisting results")
    if write:
        from app.output import send_digest_email, write_signals

        written = write_signals(reports, config=config)
        logger.info("[4/4] Supabase: wrote %d row(s)", written)
        if send_digest_email(reports, config=config):
            logger.info("[4/4] Email: digest sent via Resend")
    else:
        logger.info("[4/4] Output: skipped (dry run)")

    logger.info("=== pipeline complete: %d setup(s) flagged ===", len(reports))
    return reports
