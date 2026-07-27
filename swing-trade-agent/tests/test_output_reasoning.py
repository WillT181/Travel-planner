"""Tests for the reasoning fallback, digest rendering, and price normalisation."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.config import Config
from app.output.digest import render_html_digest, render_markdown_digest
from app.output.models import SignalReport
from app.prices.provider import PriceProviderError, normalize_ohlcv
from app.reasoning import build_prompt, explain_signal, fallback_rationale
from app.signals.models import RuleResult, Signal


def _sample_signal() -> Signal:
    return Signal(
        symbol="AMZN",
        direction="long",
        composite_score=0.72,
        triggered_rules=[RuleResult("oversold_bounce", True, 0.72, "detail")],
        key_levels={"close": 111.0, "sma_200": 100.0},
        suggested_stop=107.0,
        atr=2.0,
        as_of="2026-07-24",
    )


def test_fallback_rationale_mentions_key_facts():
    text = fallback_rationale(_sample_signal())
    assert "AMZN" in text
    assert "oversold_bounce" in text
    assert "107.0" in text or "107.00" in text
    assert "not a trade instruction" in text.lower()


def test_explain_signal_uses_fallback_without_api_key():
    cfg = Config(anthropic_api_key=None)
    text = explain_signal(_sample_signal(), config=cfg)
    assert "AMZN" in text  # deterministic fallback, no network


def test_build_prompt_contains_only_provided_numbers():
    prompt = build_prompt(_sample_signal())
    assert "0.72" in prompt
    assert "AMZN" in prompt
    assert "ONLY these numbers" in prompt


def test_markdown_digest_ranks_by_score():
    low = SignalReport(
        signal=Signal("LOW", "long", 0.4, [RuleResult("r", True, 0.4)]),
        rationale="low note",
    )
    high = SignalReport(
        signal=Signal("HIGH", "long", 0.9, [RuleResult("r", True, 0.9)]),
        rationale="high note",
    )
    md = render_markdown_digest([low, high])
    assert md.index("HIGH") < md.index("LOW")  # higher score first
    assert "Decision-support only" in md


def test_markdown_digest_empty():
    md = render_markdown_digest([])
    assert "No setups" in md


def test_html_digest_escapes_and_renders():
    rep = SignalReport(signal=_sample_signal(), rationale="a <b> note")
    html = render_html_digest([rep])
    assert "&lt;b&gt;" in html  # escaped
    assert "AMZN" in html
    assert "<!doctype html>" in html


def test_normalize_ohlcv_maps_aliases_and_sorts():
    idx = pd.to_datetime(["2023-01-03", "2023-01-02", "2023-01-04"])
    raw = pd.DataFrame(
        {
            "Open": [1.0, 2.0, 3.0],
            "High": [2, 3, 4],
            "Low": [0.5, 1.5, 2.5],
            "Close": [1.5, 2.5, 3.5],
            "Volume": [100, 200, 300],
        },
        index=idx,
    )
    out = normalize_ohlcv(raw)
    assert list(out.columns) == ["open", "high", "low", "close", "volume"]
    assert out.index.is_monotonic_increasing


def test_normalize_ohlcv_uses_adj_close_when_no_close():
    idx = pd.to_datetime(["2023-01-02", "2023-01-03"])
    raw = pd.DataFrame(
        {"Open": [1, 2], "High": [2, 3], "Low": [0, 1], "Adj Close": [1.4, 2.4], "Volume": [1, 2]},
        index=idx,
    )
    out = normalize_ohlcv(raw)
    assert "close" in out.columns
    assert out["close"].iloc[0] == pytest.approx(1.4)


def test_normalize_ohlcv_raises_on_empty():
    with pytest.raises(PriceProviderError):
        normalize_ohlcv(pd.DataFrame())
