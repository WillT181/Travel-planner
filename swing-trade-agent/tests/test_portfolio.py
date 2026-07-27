"""Tests for Trading 212 symbol mapping and position normalisation."""

from __future__ import annotations

import base64

import pytest

from app.config import Config
from app.portfolio import Position, T212Client, T212Error, clean_symbol
from app.portfolio.t212 import normalize_position


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("AMZN_US_EQ", "AMZN"),
        ("AAPL_US_EQ", "AAPL"),
        ("TSLA_US_EQ", "TSLA"),
        ("VODl_EQ", "VOD"),  # LSE line, trailing 'l' stripped
        ("BMW_DE_EQ", "BMW.DE"),
        ("MC_FR_EQ", "MC.PA"),
    ],
)
def test_clean_symbol(raw, expected):
    assert clean_symbol(raw) == expected


def test_clean_symbol_override_wins():
    assert clean_symbol("WEIRD_XX_EQ", overrides={"WEIRD_XX_EQ": "WRD"}) == "WRD"


def test_normalize_position_aliases():
    pos = normalize_position(
        {"ticker": "AMZN_US_EQ", "quantity": 3, "averagePrice": 120.5}
    )
    assert pos == Position(
        ticker="AMZN", quantity=3.0, avg_price=120.5, raw_ticker="AMZN_US_EQ"
    )
    # avgPrice alias also works.
    pos2 = normalize_position({"ticker": "AAPL_US_EQ", "quantity": 1, "avgPrice": 200})
    assert pos2.avg_price == 200.0


def test_auth_header_basic_when_secret_present():
    cfg = Config(t212_api_key="key", t212_api_secret="secret")
    client = T212Client(config=cfg)
    header = client._auth_header()
    assert header.startswith("Basic ")
    decoded = base64.b64decode(header.split(" ", 1)[1]).decode()
    assert decoded == "key:secret"


def test_auth_header_raw_key_when_no_secret():
    cfg = Config(t212_api_key="rawkey", t212_api_secret=None)
    client = T212Client(config=cfg)
    assert client._auth_header() == "rawkey"


def test_auth_header_requires_key():
    client = T212Client(config=Config(t212_api_key=None))
    with pytest.raises(T212Error):
        client._auth_header()


def test_default_base_url_is_demo():
    cfg = Config()
    assert "demo" in cfg.t212_base_url
    assert cfg.is_demo


class _FakeResp:
    def __init__(self, status, payload):
        self.status_code = status
        self._payload = payload
        self.text = str(payload)

    def json(self):
        return self._payload


class _FakeSession:
    def __init__(self, resp):
        self._resp = resp
        self.calls = []

    def get(self, url, headers=None, timeout=None):
        self.calls.append(("GET", url))
        return self._resp


def test_get_positions_parses_and_normalizes():
    payload = [
        {"ticker": "AMZN_US_EQ", "quantity": 2, "averagePrice": 100.0},
        {"ticker": "BMW_DE_EQ", "quantity": 5, "averagePrice": 90.0},
    ]
    session = _FakeSession(_FakeResp(200, payload))
    client = T212Client(config=Config(t212_api_key="k"), session=session)
    positions = client.get_positions()
    assert [p.ticker for p in positions] == ["AMZN", "BMW.DE"]
    # Only GET was used — this client has no order-placing path.
    assert session.calls[0][0] == "GET"
    assert session.calls[0][1].endswith("/equity/account/positions")


def test_get_positions_raises_on_401():
    session = _FakeSession(_FakeResp(401, {"error": "nope"}))
    client = T212Client(config=Config(t212_api_key="k"), session=session)
    with pytest.raises(T212Error):
        client.get_positions()
