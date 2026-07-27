"""Price provider interface + yfinance implementation.

The rest of the app depends only on the :class:`PriceProvider` protocol and the
normalised OHLCV shape (lowercase ``open, high, low, close, volume`` columns,
ascending DatetimeIndex). Swap providers (Alpha Vantage, Twelve Data, ...) by
implementing the same protocol — see ``factory.py``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd

OHLCV_COLUMNS = ["open", "high", "low", "close", "volume"]


class PriceProviderError(RuntimeError):
    """Raised when a provider cannot return usable OHLCV data."""


def normalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce an arbitrary provider frame into the canonical OHLCV shape.

    - lowercases and maps common column aliases
    - keeps only OHLCV columns
    - sorts ascending by date and drops fully-empty rows
    """
    if df is None or len(df) == 0:
        raise PriceProviderError("empty price frame")

    rename = {}
    for col in df.columns:
        key = str(col).strip().lower().replace(" ", "_")
        if key in {"open", "o"}:
            rename[col] = "open"
        elif key in {"high", "h"}:
            rename[col] = "high"
        elif key in {"low", "l"}:
            rename[col] = "low"
        elif key in {"close", "c", "adj_close", "adjclose"}:
            # Prefer a plain "close"; only use adj_close if no close present.
            rename[col] = "close" if key == "close" else "_adj_close"
        elif key in {"volume", "v"}:
            rename[col] = "volume"

    out = df.rename(columns=rename)
    if "close" not in out.columns and "_adj_close" in out.columns:
        out["close"] = out["_adj_close"]

    missing = [c for c in OHLCV_COLUMNS if c not in out.columns]
    if missing:
        raise PriceProviderError(f"missing OHLCV columns after normalize: {missing}")

    out = out[OHLCV_COLUMNS].copy()
    out = out.apply(pd.to_numeric, errors="coerce")
    out = out.dropna(subset=["close"])
    out = out.sort_index()
    out.index = pd.to_datetime(out.index)
    out = out[~out.index.duplicated(keep="last")]
    return out


class PriceProvider(ABC):
    """Abstract OHLCV provider."""

    name: str = "base"

    @abstractmethod
    def get_history(self, symbol: str, lookback_days: int = 400) -> pd.DataFrame:
        """Return >= ``lookback_days`` of daily OHLCV for ``symbol``."""
        raise NotImplementedError

    def get_many(
        self, symbols: list[str], lookback_days: int = 400
    ) -> dict[str, pd.DataFrame]:
        """Fetch several symbols; symbols that fail are skipped (logged)."""
        out: dict[str, pd.DataFrame] = {}
        for sym in symbols:
            try:
                out[sym] = self.get_history(sym, lookback_days=lookback_days)
            except PriceProviderError:
                continue
        return out


class YFinanceProvider(PriceProvider):
    """Daily OHLCV via the ``yfinance`` package (lazy import)."""

    name = "yfinance"

    def get_history(self, symbol: str, lookback_days: int = 400) -> pd.DataFrame:
        try:
            import yfinance as yf
        except ImportError as exc:  # pragma: no cover - env-dependent
            raise PriceProviderError(
                "yfinance is not installed. `pip install .[prices]`"
            ) from exc

        # Pad the calendar window since ~250 trading days ≈ 365 calendar days.
        period_days = int(lookback_days * 1.6) + 30
        try:
            raw = yf.Ticker(symbol).history(
                period=f"{period_days}d", interval="1d", auto_adjust=False
            )
        except Exception as exc:  # pragma: no cover - network dependent
            raise PriceProviderError(f"yfinance error for {symbol}: {exc}") from exc

        if raw is None or raw.empty:
            raise PriceProviderError(f"no data returned for {symbol}")
        return normalize_ohlcv(raw)
