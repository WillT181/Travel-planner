"""News / events provider interface + a free-tier Finnhub implementation.

Abstracted behind :class:`NewsProvider` (like the price provider) so the source
is swappable via config. Providers return FACTUAL data only — headlines
(title/source/date, never full articles) and scheduled events (e.g. earnings
dates). The API key is read from the environment (see ``app.config``).

Providers raise :class:`NewsProviderError` on misconfiguration / provider
failure; the agent tools catch that and degrade to a "no data available" note.
"""

from __future__ import annotations

import datetime as dt
from abc import ABC, abstractmethod
from dataclasses import dataclass

import requests

MAX_HEADLINES = 15


class NewsProviderError(RuntimeError):
    """Raised when a news/events provider is misconfigured or unreachable."""


@dataclass(frozen=True)
class Headline:
    title: str
    source: str
    date: str | None  # ISO date
    url: str | None = None


@dataclass(frozen=True)
class EventItem:
    type: str  # e.g. "earnings"
    date: str  # ISO date
    detail: str = ""


class NewsProvider(ABC):
    """Abstract news/events source."""

    name: str = "base"

    @abstractmethod
    def get_news(self, symbol: str, days: int = 7) -> list[Headline]:
        """Recent headlines for ``symbol`` over the last ``days``."""
        raise NotImplementedError

    @abstractmethod
    def get_upcoming_events(self, symbol: str) -> list[EventItem]:
        """Near-term scheduled events (e.g. earnings) for ``symbol``."""
        raise NotImplementedError


class FinnhubNewsProvider(NewsProvider):
    """Finnhub free tier: company-news + earnings calendar (no SDK, plain HTTP)."""

    name = "finnhub"

    def __init__(
        self,
        api_key: str | None,
        base_url: str = "https://finnhub.io/api/v1",
        session: requests.Session | None = None,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.session = session or requests.Session()

    def _get(self, path: str, params: dict) -> object:
        if not self.api_key:
            raise NewsProviderError("news API key is not set (NEWS_API_KEY).")
        params = {**params, "token": self.api_key}
        try:
            resp = self.session.get(f"{self.base_url}{path}", params=params, timeout=15)
        except requests.RequestException as exc:
            raise NewsProviderError(f"network error: {exc}") from exc
        if resp.status_code >= 400:
            raise NewsProviderError(f"news provider HTTP {resp.status_code}")
        try:
            return resp.json()
        except ValueError as exc:
            raise NewsProviderError("non-JSON response from news provider") from exc

    def get_news(self, symbol: str, days: int = 7) -> list[Headline]:
        today = dt.date.today()
        frm = (today - dt.timedelta(days=int(days))).isoformat()
        data = self._get(
            "/company-news",
            {"symbol": symbol, "from": frm, "to": today.isoformat()},
        )
        if not isinstance(data, list):
            return []
        headlines = []
        for row in data:
            ts = row.get("datetime")
            date_iso = (
                dt.datetime.fromtimestamp(ts, dt.timezone.utc).date().isoformat()
                if ts
                else None
            )
            headlines.append(
                Headline(
                    title=str(row.get("headline", "")).strip(),
                    source=str(row.get("source", "")).strip(),
                    date=date_iso,
                    url=row.get("url"),
                )
            )
        headlines.sort(key=lambda h: h.date or "", reverse=True)  # newest first
        return headlines[:MAX_HEADLINES]

    def get_upcoming_events(self, symbol: str) -> list[EventItem]:
        data = self._get("/calendar/earnings", {"symbol": symbol})
        calendar = (data or {}).get("earningsCalendar") if isinstance(data, dict) else None
        if not calendar:
            return []
        today = dt.date.today().isoformat()
        events = []
        for row in calendar:
            date_iso = row.get("date")
            if not date_iso or date_iso < today:  # upcoming only
                continue
            est = row.get("epsEstimate")
            detail = "earnings" if est is None else f"earnings (EPS estimate {est})"
            events.append(EventItem(type="earnings", date=date_iso, detail=detail))
        events.sort(key=lambda e: e.date)
        return events
