"""Swappable news / events provider for agent context (factual data only)."""

from app.news.provider import (
    EventItem,
    FinnhubNewsProvider,
    Headline,
    NewsProvider,
    NewsProviderError,
)
from app.news.factory import get_news_provider

__all__ = [
    "EventItem",
    "FinnhubNewsProvider",
    "Headline",
    "NewsProvider",
    "NewsProviderError",
    "get_news_provider",
]
