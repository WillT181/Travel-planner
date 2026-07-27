"""Select and assemble a PriceProvider from config.

Central place to swap the data source via ``PRICE_PROVIDER`` env var. New
providers (Alpha Vantage, Twelve Data) implement :class:`PriceProvider` and get
registered here.
"""

from __future__ import annotations

from app.config import Config, load_config
from app.prices.cache import CachedPriceProvider
from app.prices.provider import PriceProvider, YFinanceProvider


def _base_provider(config: Config) -> PriceProvider:
    provider = (config.price_provider or "yfinance").lower()
    if provider in {"yfinance", "yf"}:
        return YFinanceProvider()
    # Placeholders for future providers — implement PriceProvider and wire here.
    raise ValueError(
        f"Unknown PRICE_PROVIDER '{config.price_provider}'. "
        "Supported: yfinance. (Alpha Vantage / Twelve Data are pluggable.)"
    )


def get_price_provider(config: Config | None = None, use_cache: bool = True) -> PriceProvider:
    """Return a ready-to-use provider, cached to disk by default."""
    config = config or load_config()
    provider = _base_provider(config)
    if use_cache:
        return CachedPriceProvider(provider, cache_dir=config.cache_dir)
    return provider
