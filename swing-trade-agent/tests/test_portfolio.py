"""Tests for the Trading 212 client — symbol mapping, parsing, auth, errors.

The HTTP layer is fully mocked (a fake requests.Session); no test hits the real
Trading 212 API.
"""

from __future__ import annotations

import base64

import pytest

from app.config import Config
from app.portfolio import (
    Position,
    T212Client,
    T212Error,
    T212RateLimitError,
    clean_symbol,
)
from app.portfolio.t212 import normalize_position


# --- symbol mapping --------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("AMZN_US_EQ", "AMZN"),
        ("AAPL_US_EQ", "AAPL"),
        ("TSLA_US_EQ", "TSLA"),
        ("BRKB_US_EQ", "BRKB"),
        ("VODl_EQ", "VOD.L"),  # LSE line: trailing 'l' -> .L
        ("VOD_GB_EQ", "VOD.L"),  # explicit GB code -> .L
        ("BMW_DE_EQ", "BMW.DE"),
        ("MC_FR_EQ", "MC.PA"),
        ("ASML_NL_EQ", "ASML.AS"),
        ("SHOP_CA_EQ", "SHOP.TO"),
    ],
)
def test_clean_symbol(raw, expected):
    assert clean_symbol(raw) == expected


def test_clean_symbol_override_wins():
    assert clean_symbol("WEIRD_XX_EQ", overrides={"WEIRD_XX_EQ": "WRD"}) == "WRD"


def test_clean_symbol_unknown_falls_back_to_base():
    assert clean_symbol("FOO_ZZ_EQ") == "FOO"


# --- position normalisation ------------------------------------------------


def test_normalize_position_fields_and_aliases():
    pos = normalize_position(
        {"ticker": "AMZN_US_EQ", "quantity": 3, "averagePrice": 120.5}
    )
    assert pos == Position(
        ticker="AMZN", quantity=3.0, avg_price=120.5, raw_ticker="AMZN_US_EQ"
    )
    # avgPrice alias also works.
    pos2 = normalize_position({"ticker": "AAPL_US_EQ", "quantity": 1, "avgPrice": 200})
    assert pos2.avg_price == 200.0


# --- auth ------------------------------------------------------------------


def test_auth_header_basic_when_secret_present():
    client = T212Client(config=Config(t212_api_key="key", t212_api_secret="secret"))
    header = client._auth_header()
    assert header.startswith("Basic ")
    decoded = base64.b64decode(header.split(" ", 1)[1]).decode()
    assert decoded == "key:secret"


def test_auth_header_raw_key_when_no_secret():
    client = T212Client(config=Config(t212_api_key="rawkey", t212_api_secret=None))
    assert client._auth_header() == "rawkey"


def test_auth_header_requires_key():
    client = T212Client(config=Config(t212_api_key=None))
    with pytest.raises(T212Error):
        client._auth_header()


def test_default_base_url_is_demo():
    cfg = Config()
    assert "demo" in cfg.t212_base_url
    assert cfg.is_demo


# --- mocked HTTP layer -----------------------------------------------------


class _FakeResp:
    def __init__(self, status, payload=None, *, headers=None, text=None):
        self.status_code = status
        self._payload = payload
        self.headers = headers or {}
        self.text = text if text is not None else str(payload)

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class _FakeSession:
    """Returns queued responses in order (last one repeats)."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def get(self, url, headers=None, timeout=None):
        self.calls.append(("GET", url, headers))
        resp = self._responses.pop(0) if len(self._responses) > 1 else self._responses[0]
        return resp


def _client(responses, **kwargs):
    return T212Client(
        config=Config(t212_api_key="k"),
        session=_FakeSession(responses),
        sleep=lambda _s: None,  # never really sleep in tests
        **kwargs,
    )


def test_get_positions_parses_and_hits_portfolio_endpoint():
    payload = [
        {"ticker": "AMZN_US_EQ", "quantity": 2, "averagePrice": 100.0},
        {"ticker": "BMW_DE_EQ", "quantity": 5, "averagePrice": 90.0},
    ]
    client = _client([_FakeResp(200, payload)])
    positions = client.get_positions()
    assert [p.ticker for p in positions] == ["AMZN", "BMW.DE"]
    assert [p.quantity for p in positions] == [2.0, 5.0]
    # Correct endpoint, and only GET was used (no order-placing path exists).
    method, url, _headers = client.session.calls[0]
    assert method == "GET"
    assert url.endswith("/equity/portfolio")


def test_basic_auth_header_is_sent():
    client = T212Client(
        config=Config(t212_api_key="key", t212_api_secret="secret"),
        session=_FakeSession([_FakeResp(200, [])]),
    )
    client.get_positions()
    _m, _u, headers = client.session.calls[0]
    assert headers["Authorization"].startswith("Basic ")


def test_rate_limit_retries_then_succeeds():
    client = _client(
        [
            _FakeResp(429, headers={"Retry-After": "0"}),
            _FakeResp(429, headers={"Retry-After": "0"}),
            _FakeResp(200, [{"ticker": "AAPL_US_EQ", "quantity": 1, "averagePrice": 10}]),
        ]
    )
    positions = client.get_positions()
    assert [p.ticker for p in positions] == ["AAPL"]
    assert len(client.session.calls) == 3  # two 429s then success


def test_rate_limit_exhausted_raises():
    client = _client([_FakeResp(429, headers={"Retry-After": "0"})], max_retries=2)
    with pytest.raises(T212RateLimitError):
        client.get_positions()
    # initial attempt + 2 retries == 3 calls
    assert len(client.session.calls) == 3


def test_401_raises_clear_error():
    client = _client([_FakeResp(401, {"error": "bad key"})])
    with pytest.raises(T212Error, match="401"):
        client.get_positions()


def test_500_raises_clear_error():
    client = _client([_FakeResp(500, text="upstream boom")])
    with pytest.raises(T212Error, match="500"):
        client.get_positions()


def test_non_list_payload_raises():
    client = _client([_FakeResp(200, {"not": "a list"})])
    with pytest.raises(T212Error):
        client.get_positions()
