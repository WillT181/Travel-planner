"""Select a NewsProvider from config (swap the source via NEWS_PROVIDER)."""

from __future__ import annotations

from app.config import Config, load_config
from app.news.provider import FinnhubNewsProvider, NewsProvider


def get_news_provider(config: Config | None = None) -> NewsProvider:
    config = config or load_config()
    name = (config.news_provider or "finnhub").lower()
    if name in {"finnhub"}:
        return FinnhubNewsProvider(api_key=config.news_api_key, base_url=config.news_base_url)
    # Placeholder for future providers (Alpha Vantage, Marketaux, ...).
    raise ValueError(
        f"Unknown NEWS_PROVIDER '{config.news_provider}'. Supported: finnhub."
    )
