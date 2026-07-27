"""Central configuration loaded from environment variables / .env.

All secrets come from the environment. Nothing here is trade-enabling; the
Trading 212 integration defaults to the DEMO environment and read-only usage.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# Load a local .env if python-dotenv is available. This is best-effort: the
# app also works when env vars are exported directly (e.g. in CI).
try:  # pragma: no cover - trivial import guard
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover
    pass


# Default to the Trading 212 DEMO base URL. Never default to live.
DEMO_BASE_URL = "https://demo.trading212.com/api/v0"

# Anthropic model used ONLY for turning structured signals into prose.
DEFAULT_LLM_MODEL = "claude-opus-4-8"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CACHE_DIR = PROJECT_ROOT / ".cache" / "prices"


def _get(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value


@dataclass(frozen=True)
class Config:
    """Runtime configuration snapshot."""

    # --- Trading 212 (read-only, demo by default) ---
    t212_api_key: str | None = field(default_factory=lambda: _get("T212_API_KEY"))
    t212_api_secret: str | None = field(default_factory=lambda: _get("T212_API_SECRET"))
    t212_base_url: str = field(
        default_factory=lambda: _get("T212_BASE_URL", DEMO_BASE_URL) or DEMO_BASE_URL
    )

    # --- Price provider ---
    price_provider: str = field(
        default_factory=lambda: _get("PRICE_PROVIDER", "yfinance") or "yfinance"
    )
    alpha_vantage_key: str | None = field(
        default_factory=lambda: _get("ALPHA_VANTAGE_API_KEY")
    )
    twelve_data_key: str | None = field(default_factory=lambda: _get("TWELVE_DATA_API_KEY"))
    cache_dir: Path = field(
        default_factory=lambda: Path(_get("PRICE_CACHE_DIR", str(DEFAULT_CACHE_DIR)))
    )

    # --- News / events provider (agent context; optional, free-tier) ---
    news_provider: str = field(
        default_factory=lambda: _get("NEWS_PROVIDER", "finnhub") or "finnhub"
    )
    news_api_key: str | None = field(
        default_factory=lambda: _get("NEWS_API_KEY") or _get("FINNHUB_API_KEY")
    )
    news_base_url: str = field(
        default_factory=lambda: _get("NEWS_BASE_URL", "https://finnhub.io/api/v1")
        or "https://finnhub.io/api/v1"
    )

    # --- Anthropic (reasoning only) ---
    anthropic_api_key: str | None = field(
        default_factory=lambda: _get("ANTHROPIC_API_KEY")
    )
    llm_model: str = field(
        default_factory=lambda: _get("LLM_MODEL", DEFAULT_LLM_MODEL) or DEFAULT_LLM_MODEL
    )

    # --- Supabase output ---
    supabase_url: str | None = field(default_factory=lambda: _get("SUPABASE_URL"))
    supabase_service_role_key: str | None = field(
        default_factory=lambda: _get("SUPABASE_SERVICE_ROLE_KEY")
    )

    # --- Email digest (optional) ---
    resend_api_key: str | None = field(default_factory=lambda: _get("RESEND_API_KEY"))
    digest_from: str | None = field(default_factory=lambda: _get("DIGEST_FROM"))
    digest_to: str | None = field(default_factory=lambda: _get("DIGEST_TO"))

    # --- Pipeline tuning ---
    signal_threshold: float = field(
        default_factory=lambda: float(_get("SIGNAL_THRESHOLD", "0.4") or "0.4")
    )
    history_days: int = field(
        default_factory=lambda: int(_get("HISTORY_DAYS", "400") or "400")
    )

    @property
    def is_demo(self) -> bool:
        """True when pointed at a non-production Trading 212 host."""
        return "demo" in self.t212_base_url.lower()

    def require_t212(self) -> None:
        if not self.t212_api_key:
            raise RuntimeError(
                "T212_API_KEY is not set. Configure a READ-ONLY demo key in .env."
            )


def load_config() -> Config:
    """Build a Config from the current environment."""
    return Config()
