"""Tests for the news/events provider and the agent's news tools.

The HTTP layer is mocked (a fake session) and the provider is mocked for the
tool tests — no network. Covers a normal fetch, the empty result, and the
provider-error fallback for both news and events.
"""

from __future__ import annotations

import datetime as dt

import pytest

from app.config import Config
from app.news import FinnhubNewsProvider, NewsProviderError, get_news_provider


class _FakeResp:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class _FakeSession:
    """Returns a queued response and records the requested path + params."""

    def __init__(self, resp=None, error=None):
        self._resp = resp
        self._error = error
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, params))
        if self._error is not None:
            raise self._error
        return self._resp


def _provider(session):
    return FinnhubNewsProvider(api_key="k", base_url="https://finnhub.io/api/v1", session=session)


# --- get_news --------------------------------------------------------------


def test_get_news_normal_fetch():
    ts = int(dt.datetime(2026, 7, 20, tzinfo=dt.timezone.utc).timestamp())
    payload = [
        {"headline": "Q2 beats", "source": "Reuters", "datetime": ts, "url": "http://x"},
        {"headline": "Analyst upgrade", "source": "Bloomberg", "datetime": ts - 86400},
    ]
    session = _FakeSession(_FakeResp(payload))
    out = _provider(session).get_news("AAPL", days=7)

    assert [h.title for h in out] == ["Q2 beats", "Analyst upgrade"]  # newest first
    assert out[0].source == "Reuters"
    assert out[0].date == "2026-07-20"
    # The token and symbol were sent; full article body is never returned.
    url, params = session.calls[0]
    assert url.endswith("/company-news")
    assert params["symbol"] == "AAPL" and params["token"] == "k"
    assert not hasattr(out[0], "body")


def test_get_news_empty_result():
    out = _provider(_FakeSession(_FakeResp([]))).get_news("AAPL")
    assert out == []


def test_get_news_provider_error_on_http_500():
    with pytest.raises(NewsProviderError):
        _provider(_FakeSession(_FakeResp(None, status=500))).get_news("AAPL")


def test_get_news_provider_error_on_network():
    import requests

    session = _FakeSession(error=requests.RequestException("boom"))
    with pytest.raises(NewsProviderError):
        _provider(session).get_news("AAPL")


def test_get_news_requires_api_key():
    p = FinnhubNewsProvider(api_key=None, session=_FakeSession(_FakeResp([])))
    with pytest.raises(NewsProviderError):
        p.get_news("AAPL")


# --- get_upcoming_events ---------------------------------------------------


def test_get_upcoming_events_filters_to_future():
    today = dt.date.today()
    future = (today + dt.timedelta(days=10)).isoformat()
    past = (today - dt.timedelta(days=10)).isoformat()
    payload = {"earningsCalendar": [
        {"date": future, "epsEstimate": 1.23},
        {"date": past, "epsEstimate": 1.0},  # dropped: already happened
    ]}
    out = _provider(_FakeSession(_FakeResp(payload))).get_upcoming_events("AAPL")
    assert [e.date for e in out] == [future]
    assert out[0].type == "earnings"
    assert "1.23" in out[0].detail


def test_get_upcoming_events_empty():
    out = _provider(_FakeSession(_FakeResp({"earningsCalendar": []}))).get_upcoming_events("AAPL")
    assert out == []


def test_get_upcoming_events_error():
    with pytest.raises(NewsProviderError):
        _provider(_FakeSession(_FakeResp(None, status=403))).get_upcoming_events("AAPL")


# --- factory ---------------------------------------------------------------


def test_factory_returns_finnhub():
    p = get_news_provider(Config(news_provider="finnhub"))
    assert isinstance(p, FinnhubNewsProvider)


def test_factory_unknown_provider_raises():
    with pytest.raises(ValueError):
        get_news_provider(Config(news_provider="nope"))


# --- agent tools degrade gracefully ----------------------------------------


def test_tool_get_news_normal(monkeypatch):
    from app.news import Headline
    from app import agent

    class _P:
        def get_news(self, symbol, days=7):
            return [Headline(title="Beat", source="Reuters", date="2026-07-20")]

    monkeypatch.setattr("app.news.get_news_provider", lambda cfg: _P())
    out = agent.tool_get_news("AAPL", days=7)
    assert out["news"] == [{"title": "Beat", "source": "Reuters", "date": "2026-07-20"}]
    assert out["note"] == ""


def test_tool_get_news_empty_note(monkeypatch):
    from app import agent

    class _P:
        def get_news(self, symbol, days=7):
            return []

    monkeypatch.setattr("app.news.get_news_provider", lambda cfg: _P())
    out = agent.tool_get_news("AAPL")
    assert out["news"] == []
    assert "No recent headlines" in out["note"]


def test_tool_get_news_error_degrades(monkeypatch):
    from app import agent

    def _boom(cfg):
        raise NewsProviderError("provider down")

    monkeypatch.setattr("app.news.get_news_provider", _boom)
    out = agent.tool_get_news("AAPL")
    assert out["news"] == []
    assert "No data available" in out["note"]  # degraded, not crashed


def test_tool_get_upcoming_events_error_degrades(monkeypatch):
    from app import agent

    def _boom(cfg):
        raise NewsProviderError("down")

    monkeypatch.setattr("app.news.get_news_provider", _boom)
    out = agent.tool_get_upcoming_events("AAPL")
    assert out["events"] == []
    assert "No data available" in out["note"]
