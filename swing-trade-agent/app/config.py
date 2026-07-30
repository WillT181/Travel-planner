"""Central configuration loaded from environment variables / .env.

All secrets come from the environment. Nothing here is trade-enabling; the
Trading 212 integration defaults to the DEMO environment and read-only usage.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

# Load the project's own .env if python-dotenv is available. Point at
# PROJECT_ROOT/.env EXPLICITLY: bare load_dotenv() searches upward from the
# current working directory, so starting the server from anywhere other than
# swing-trade-agent/ silently found no keys. Existing environment variables
# still win (override=False), which keeps CI and `KEY=... python -m app.run`
# working.
def _load_env_file_fallback(path: Path) -> None:
    """Minimal KEY=VALUE .env reader used when python-dotenv is unavailable.

    Without this, a missing/broken python-dotenv made the app silently ignore
    .env entirely — surfacing only as a confusing "API key is not configured".
    Existing environment variables always win, matching load_dotenv(override=False).
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.lower().startswith("export "):
            line = line[7:].lstrip()
        name, _, value = line.partition("=")
        name = name.strip()
        value = value.strip().split(" #", 1)[0].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if name and name not in os.environ:
            os.environ[name] = value


try:  # pragma: no cover - trivial import guard
    from dotenv import load_dotenv

    load_dotenv(dotenv_path=ENV_FILE, override=False)
    # Fall back to the upward search for unusual layouts / installed copies.
    if not ENV_FILE.exists():
        load_dotenv(override=False)
except Exception:  # pragma: no cover - python-dotenv missing or broken
    _load_env_file_fallback(ENV_FILE)


# Default to the Trading 212 DEMO base URL. Never default to live.
DEMO_BASE_URL = "https://demo.trading212.com/api/v0"

# Anthropic model used ONLY for turning structured signals into prose.
DEFAULT_LLM_MODEL = "claude-opus-4-8"

DEFAULT_CACHE_DIR = PROJECT_ROOT / ".cache" / "prices"


def _get(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value


def _get_float(name: str, default: float | None = None) -> float | None:
    """Read a numeric env var, ignoring blanks and unparseable values."""
    raw = _get(name)
    if raw is None:
        return default
    try:
        return float(str(raw).replace(",", "").strip())
    except ValueError:
        return default


def _split_symbols(raw: str | None) -> list[str]:
    """Parse "AAPL,MSFT NVDA" into ["AAPL", "MSFT", "NVDA"] (order preserved)."""
    if not raw:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for chunk in raw.replace(",", " ").split():
        sym = chunk.strip().upper()
        if sym and sym not in seen:
            seen.add(sym)
            out.append(sym)
    return out


@dataclass(frozen=True)
class Config:
    """Runtime configuration snapshot."""

    # --- Trading 212 (read-only, demo by default) ---
    t212_api_key: str | None = field(default_factory=lambda: _get("T212_API_KEY"))
    t212_api_secret: str | None = field(default_factory=lambda: _get("T212_API_SECRET"))
    t212_base_url: str = field(
        default_factory=lambda: _get("T212_BASE_URL", DEMO_BASE_URL) or DEMO_BASE_URL
    )

    # --- Symbol universe ---
    # Screened when Trading 212 is unconfigured/unavailable, so the whole app
    # runs without a broker account. Accepts commas and/or whitespace.
    watchlist: list[str] = field(
        default_factory=lambda: _split_symbols(_get("WATCHLIST"))
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

    # --- Trade levels / position sizing (arithmetic only; never places orders) ---
    # Account size is opt-in: without it, levels are still computed but no share
    # count is suggested.
    account_size: float | None = field(
        default_factory=lambda: _get_float("ACCOUNT_SIZE")
    )
    risk_per_trade_pct: float = field(
        default_factory=lambda: _get_float("RISK_PER_TRADE_PCT", 1.0) or 1.0
    )
    max_position_pct: float = field(
        default_factory=lambda: _get_float("MAX_POSITION_PCT", 20.0) or 20.0
    )
    min_reward_risk: float = field(
        default_factory=lambda: _get_float("MIN_REWARD_RISK", 1.5) or 1.5
    )

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
