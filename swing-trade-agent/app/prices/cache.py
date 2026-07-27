"""Local parquet cache wrapper for any PriceProvider.

Caches each fetch to ``<cache_dir>/<SYMBOL>_<YYYY-MM-DD>.parquet``, keyed by
symbol **and** date. The first fetch of a symbol on a given day hits the
underlying provider and writes the parquet file; later runs the same day read
it back instead of re-hitting the provider. A new day means a new key, so data
refreshes daily without any manual cache-busting.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Callable

import pandas as pd

from app.prices.provider import PriceProvider, PriceProviderError, normalize_ohlcv


def _safe_name(symbol: str) -> str:
    return symbol.replace("/", "_").replace("\\", "_").replace(" ", "_")


class CachedPriceProvider(PriceProvider):
    """Decorator that adds a symbol+date parquet cache around another provider."""

    def __init__(
        self,
        inner: PriceProvider,
        cache_dir: str | Path,
        today: Callable[[], dt.date] = dt.date.today,
    ):
        self.inner = inner
        self.cache_dir = Path(cache_dir)
        self._today = today
        self.name = f"cached({inner.name})"

    def _path(self, symbol: str) -> Path:
        return self.cache_dir / f"{_safe_name(symbol)}_{self._today().isoformat()}.parquet"

    def _read(self, path: Path) -> pd.DataFrame | None:
        try:
            df = pd.read_parquet(path)
            return normalize_ohlcv(df)
        except (FileNotFoundError, PriceProviderError):
            return None
        except Exception:
            # A corrupt/unreadable cache file should never break a run; refetch.
            return None

    def _write(self, path: Path, df: pd.DataFrame) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        df.to_parquet(path)

    def get_history(self, symbol: str, lookback_days: int = 400) -> pd.DataFrame:
        path = self._path(symbol)
        if path.exists():
            cached = self._read(path)
            if cached is not None and len(cached) > 0:
                return cached

        fresh = self.inner.get_history(symbol, lookback_days=lookback_days)
        self._write(path, fresh)
        return fresh
