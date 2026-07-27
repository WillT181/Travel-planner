"""Trading 212 Public API client (READ-ONLY).

Only GET endpoints are used. This module cannot place, modify, or cancel
orders — there is deliberately no code path that POSTs to an order endpoint.

Base URL defaults to the DEMO environment
(https://demo.trading212.com/api/v0). Auth follows the project spec: Basic
auth with a base64-encoded ``API_KEY:API_SECRET``. Trading 212's own public API
also accepts the raw API key in the ``Authorization`` header, so when no secret
is configured we fall back to that scheme.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass

import requests

from app.config import Config, load_config

# T212 exchange suffix -> yfinance suffix. US listings map to the bare symbol.
# Extend as needed; unknown suffixes fall back to the bare base symbol.
_EXCHANGE_SUFFIX = {
    "US": "",  # NASDAQ/NYSE -> AAPL
    "GB": ".L",  # London
    "DE": ".DE",  # Xetra
    "FR": ".PA",  # Euronext Paris
    "NL": ".AS",  # Euronext Amsterdam
    "ES": ".MC",  # Madrid
    "IT": ".MI",  # Milan
}


class T212Error(RuntimeError):
    """Raised when the Trading 212 API returns an error."""


@dataclass(frozen=True)
class Position:
    """A normalised portfolio position."""

    ticker: str  # cleaned symbol, e.g. "AMZN"
    quantity: float
    avg_price: float
    raw_ticker: str = ""  # original T212 ticker, e.g. "AMZN_US_EQ"


def clean_symbol(t212_ticker: str, overrides: dict[str, str] | None = None) -> str:
    """Map a Trading 212 ticker (e.g. ``AMZN_US_EQ``) to a clean symbol.

    ``overrides`` lets the caller pin awkward mappings explicitly
    (``{"ABC_US_EQ": "ABC"}``) — checked first.
    """
    overrides = overrides or {}
    if t212_ticker in overrides:
        return overrides[t212_ticker]

    parts = t212_ticker.split("_")
    base = parts[0]
    # A trailing lowercase letter on the base often denotes the LSE line
    # (e.g. "VODl_EQ" -> Vodafone on London). Strip a single trailing 'l'.
    if base[-1:] == "l" and base[:-1].isupper():
        base = base[:-1]

    # Look for a 2-letter country/exchange code among the parts.
    for part in parts[1:]:
        if part in _EXCHANGE_SUFFIX:
            return f"{base}{_EXCHANGE_SUFFIX[part]}"
    return base


class T212Client:
    """Thin read-only wrapper over the Trading 212 Public API."""

    def __init__(self, config: Config | None = None, session: requests.Session | None = None):
        self.config = config or load_config()
        self.session = session or requests.Session()

    def _auth_header(self) -> str:
        cfg = self.config
        if not cfg.t212_api_key:
            raise T212Error("T212_API_KEY is not set (use a READ-ONLY demo key).")
        if cfg.t212_api_secret:
            token = base64.b64encode(
                f"{cfg.t212_api_key}:{cfg.t212_api_secret}".encode()
            ).decode()
            return f"Basic {token}"
        # T212 public API: the API key is sent directly as the Authorization value.
        return cfg.t212_api_key

    def _get(self, path: str, timeout: float = 20.0) -> object:
        url = f"{self.config.t212_base_url.rstrip('/')}{path}"
        headers = {"Authorization": self._auth_header(), "Accept": "application/json"}
        try:
            resp = self.session.get(url, headers=headers, timeout=timeout)
        except requests.RequestException as exc:  # network error
            raise T212Error(f"Network error calling {url}: {exc}") from exc

        if resp.status_code == 401:
            raise T212Error("Unauthorized (401) — check the read-only API key.")
        if resp.status_code == 403:
            raise T212Error("Forbidden (403) — key lacks scope or wrong environment.")
        if resp.status_code >= 400:
            raise T212Error(f"T212 API error {resp.status_code}: {resp.text[:200]}")
        try:
            return resp.json()
        except ValueError as exc:
            raise T212Error(f"Non-JSON response from {url}") from exc

    def get_positions_raw(self) -> list[dict]:
        """Raw list from GET /equity/account/positions."""
        data = self._get("/equity/account/positions")
        if not isinstance(data, list):
            raise T212Error(f"Unexpected positions payload: {type(data).__name__}")
        return data

    def get_positions(self, overrides: dict[str, str] | None = None) -> list[Position]:
        """Normalised positions with clean symbols."""
        return [
            normalize_position(item, overrides=overrides)
            for item in self.get_positions_raw()
        ]


def normalize_position(item: dict, overrides: dict[str, str] | None = None) -> Position:
    """Convert one raw T212 position dict into a :class:`Position`.

    T212 uses ``ticker``, ``quantity`` and ``averagePrice`` (a.k.a.
    ``avgPrice``) fields; we accept common aliases defensively.
    """
    raw_ticker = str(item.get("ticker", ""))
    quantity = float(item.get("quantity", 0.0) or 0.0)
    avg_price = float(
        item.get("averagePrice", item.get("avgPrice", 0.0)) or 0.0
    )
    return Position(
        ticker=clean_symbol(raw_ticker, overrides=overrides),
        quantity=quantity,
        avg_price=avg_price,
        raw_ticker=raw_ticker,
    )


def fetch_positions(config: Config | None = None) -> list[Position]:
    """Convenience entrypoint used by the pipeline."""
    return T212Client(config=config).get_positions()
