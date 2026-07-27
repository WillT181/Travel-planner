"""Trading 212 Public API client (READ-ONLY).

Only GET endpoints are used. This module cannot place, modify, or cancel
orders — there is deliberately no code path that POSTs to any endpoint.

Base URL defaults to the DEMO environment
(``https://demo.trading212.com/api/v0``, from ``T212_BASE_URL``). Open positions
come from ``GET /equity/portfolio`` — the Trading 212 endpoint that lists every
open equity position.

Auth follows the project spec: HTTP Basic with a base64-encoded
``T212_API_KEY:T212_API_SECRET``. Trading 212's own public API instead expects
the raw API key in the ``Authorization`` header (no secret), so when no secret
is configured we fall back to that scheme — the client works against either.

Rate limits: the portfolio endpoint is rate-limited; a ``429`` is retried with
backoff (honouring ``Retry-After``) and then surfaced as a clear error.
"""

from __future__ import annotations

import base64
import time
from dataclasses import dataclass
from typing import Callable

import requests

from app.config import Config, load_config

# T212 exchange code -> yfinance suffix. US listings map to the bare symbol.
# Unknown codes fall back to the bare base symbol (override explicitly if needed).
_EXCHANGE_SUFFIX = {
    "US": "",  # NASDAQ / NYSE -> AAPL
    "GB": ".L",  # London
    "UK": ".L",
    "DE": ".DE",  # Xetra
    "FR": ".PA",  # Euronext Paris
    "NL": ".AS",  # Euronext Amsterdam
    "ES": ".MC",  # Madrid
    "IT": ".MI",  # Milan
    "CA": ".TO",  # Toronto
}

# Endpoint that returns all open equity positions.
POSITIONS_PATH = "/equity/portfolio"

# Retry ceiling for a single 429 backoff step (seconds).
_MAX_BACKOFF = 30.0


class T212Error(RuntimeError):
    """Raised when the Trading 212 API returns an error or is unreachable."""


class T212RateLimitError(T212Error):
    """Raised when the API keeps returning 429 after our retries are exhausted."""


@dataclass(frozen=True)
class Position:
    """A normalised portfolio position."""

    ticker: str  # cleaned symbol, e.g. "AMZN"
    quantity: float
    avg_price: float
    raw_ticker: str = ""  # original T212 ticker, e.g. "AMZN_US_EQ"


def clean_symbol(t212_ticker: str, overrides: dict[str, str] | None = None) -> str:
    """Map a Trading 212 ticker (e.g. ``AMZN_US_EQ``) to a clean/standard symbol.

    The result is yfinance-compatible: US listings become the bare symbol
    (``AMZN``); other exchanges get the yfinance suffix (``BMW_DE_EQ`` ->
    ``BMW.DE``, London -> ``.L``). ``overrides`` pins awkward mappings
    explicitly (``{"WEIRD_XX_EQ": "WRD"}``) and is checked first.
    """
    overrides = overrides or {}
    if t212_ticker in overrides:
        return overrides[t212_ticker]

    parts = t212_ticker.split("_")
    base = parts[0]

    # An explicit 2-letter exchange code among the parts wins.
    for part in parts[1:]:
        if part in _EXCHANGE_SUFFIX:
            return f"{base}{_EXCHANGE_SUFFIX[part]}"

    # Otherwise a trailing lowercase 'l' on the symbol denotes the London line
    # (e.g. "VODl_EQ" -> Vodafone on the LSE -> "VOD.L").
    if base[-1:] == "l" and base[:-1].isupper() and len(base) > 1:
        return f"{base[:-1]}.L"

    return base


def _retry_after_seconds(resp: requests.Response, default: float) -> float:
    """Seconds to wait before retrying a 429, from Retry-After or a default."""
    header = resp.headers.get("Retry-After") if resp.headers else None
    if header:
        try:
            return min(float(header), _MAX_BACKOFF)
        except (TypeError, ValueError):
            pass
    return min(default, _MAX_BACKOFF)


class T212Client:
    """Thin READ-ONLY wrapper over the Trading 212 Public API."""

    def __init__(
        self,
        config: Config | None = None,
        session: requests.Session | None = None,
        max_retries: int = 3,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.config = config or load_config()
        self.session = session or requests.Session()
        self.max_retries = max_retries
        self._sleep = sleep

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

        attempt = 0
        while True:
            try:
                resp = self.session.get(url, headers=headers, timeout=timeout)
            except requests.RequestException as exc:  # network / timeout
                raise T212Error(f"Network error calling {url}: {exc}") from exc

            if resp.status_code == 429:
                if attempt < self.max_retries:
                    delay = _retry_after_seconds(resp, default=2.0 ** attempt)
                    self._sleep(delay)
                    attempt += 1
                    continue
                raise T212RateLimitError(
                    "Trading 212 rate limit hit (429) and retries exhausted — the "
                    "portfolio endpoint is rate-limited; try again shortly."
                )

            if resp.status_code == 401:
                raise T212Error(
                    "Unauthorized (401) — check the read-only API key/secret."
                )
            if resp.status_code == 403:
                raise T212Error(
                    "Forbidden (403) — key lacks scope or wrong environment (demo vs live)."
                )
            if resp.status_code >= 400:
                body = (resp.text or "")[:200]
                raise T212Error(f"T212 API error {resp.status_code}: {body}")

            try:
                return resp.json()
            except ValueError as exc:
                raise T212Error(f"Non-JSON response from {url}") from exc

    def get_positions_raw(self) -> list[dict]:
        """Raw list of open positions from ``GET /equity/portfolio``."""
        data = self._get(POSITIONS_PATH)
        if not isinstance(data, list):
            raise T212Error(
                f"Unexpected positions payload (expected a list): {type(data).__name__}"
            )
        return data

    def get_positions(self, overrides: dict[str, str] | None = None) -> list[Position]:
        """Open positions, normalised with clean symbols."""
        return [
            normalize_position(item, overrides=overrides)
            for item in self.get_positions_raw()
        ]


def normalize_position(item: dict, overrides: dict[str, str] | None = None) -> Position:
    """Convert one raw T212 position dict into a :class:`Position`.

    The portfolio endpoint returns ``ticker``, ``quantity`` and ``averagePrice``
    per position; we accept the ``avgPrice`` alias defensively.
    """
    raw_ticker = str(item.get("ticker", ""))
    quantity = float(item.get("quantity", 0.0) or 0.0)
    avg_price = float(item.get("averagePrice", item.get("avgPrice", 0.0)) or 0.0)
    return Position(
        ticker=clean_symbol(raw_ticker, overrides=overrides),
        quantity=quantity,
        avg_price=avg_price,
        raw_ticker=raw_ticker,
    )


def fetch_positions(config: Config | None = None) -> list[Position]:
    """Convenience entrypoint used by the pipeline."""
    return T212Client(config=config).get_positions()
