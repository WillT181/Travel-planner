"""Local parquet cache wrapper for any PriceProvider.

Caches each symbol's normalised OHLCV to ``<cache_dir>/<SYMBOL>.parquet`` and
serves from disk when the cache is fresh (same trading day), avoiding repeated
network fetches. Falls back to CSV if pyarrow is unavailable.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd

from app.prices.provider import PriceProvider, PriceProviderError, normalize_ohlcv


def _safe_name(symbol: str) -> str:
    return symbol.replace("/", "_").replace("\\", "_")


class CachedPriceProvider(PriceProvider):
    """Decorator that adds a disk cache around another provider."""

    def __init__(self, inner: PriceProvider, cache_dir: str | Path, ttl_hours: float = 20.0):
        self.inner = inner
        self.cache_dir = Path(cache_dir)
        self.ttl = dt.timedelta(hours=ttl_hours)
        self.name = f"cached({inner.name})"

    def _path(self, symbol: str) -> Path:
        return self.cache_dir / f"{_safe_name(symbol)}.parquet"

    def _is_fresh(self, path: Path) -> bool:
        if not path.exists():
            return False
        mtime = dt.datetime.fromtimestamp(path.stat().st_mtime)
        return (dt.datetime.now() - mtime) < self.ttl

    def _read(self, path: Path) -> pd.DataFrame | None:
        try:
            df = pd.read_parquet(path)
        except Exception:
            try:
                df = pd.read_csv(path.with_suffix(".csv"), index_col=0, parse_dates=True)
            except Exception:
                return None
        try:
            return normalize_ohlcv(df)
        except PriceProviderError:
            return None

    def _write(self, path: Path, df: pd.DataFrame) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        try:
            df.to_parquet(path)
        except Exception:
            # pyarrow/fastparquet not available -> CSV fallback.
            df.to_csv(path.with_suffix(".csv"))

    def get_history(self, symbol: str, lookback_days: int = 400) -> pd.DataFrame:
        path = self._path(symbol)
        if self._is_fresh(path):
            cached = self._read(path)
            if cached is not None and len(cached) >= min(lookback_days, 200):
                return cached

        fresh = self.inner.get_history(symbol, lookback_days=lookback_days)
        self._write(path, fresh)
        return fresh
