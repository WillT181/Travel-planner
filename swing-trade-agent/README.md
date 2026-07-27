# Swing Trade Signal Agent

A Python **decision-support** tool that scans the stocks in your Trading 212
portfolio for swing-trading setups and writes plain-English rationales for each
one.

> ⚠️ **This tool does not trade.** It flags setups for *you* to review. There
> is no order-placement code anywhere in this repository. It runs against the
> Trading 212 **demo** environment with a **read-only** API key by default.

## How it works

```
Trading 212        yfinance         pandas/numpy        rules engine
 positions   ─►   OHLCV history ─►   indicators   ─►   (pure Python)  ─┐
 (read-only)      (cached)          RSI/MACD/…         boolean+score   │
                                                                       ▼
                                            composite score ≥ threshold?
                                                                       │
                          Claude API (prose only)  ◄────────  structured signal JSON
                                                                       │
                                                                       ▼
                                        Supabase `signals` + markdown/HTML digest + email
```

**The golden rule:** every indicator value and every buy/sell signal is
computed by deterministic Python. The Claude API is used *only* to translate the
already-computed structured signal into a readable explanation — it never
computes or infers a number. See [`CLAUDE.md`](CLAUDE.md).

## Modules

| Module | What it does | Trades? |
|--------|--------------|---------|
| `app.portfolio` | Read-only Trading 212 positions → clean symbols | No (GET only) |
| `app.prices` | Daily OHLCV via a swappable `PriceProvider`, parquet-cached | No |
| `app.indicators` | RSI, MACD, SMA/EMA, Bollinger, ATR, OBV, volume SMA | No |
| `app.signals` | Rules engine → per-symbol `Signal` (score, levels, stop) | No |
| `app.backtest` | Replays rules over history → hit-rate / forward return | No |
| `app.reasoning` | Claude turns signal JSON → rationale (prose only) | No |
| `app.output` | Supabase writer + markdown/HTML digest + email | No |

## Setup

```bash
cd swing-trade-agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # or: pip install -e ".[dev,prices,reasoning,output]"
cp .env.example .env                      # then fill in a READ-ONLY demo key
```

Only `pandas`, `numpy`, `requests`, `python-dotenv` are required for the
trust-critical core (indicators/signals/backtest) and the tests. The rest
(`yfinance`, `anthropic`, `supabase`) are needed for live data, reasoning and
persistence respectively.

## Run against the demo portfolio

```bash
# Full pipeline: portfolio → signals → rationale → digest (stdout markdown)
python -m app.run run

# Explicit symbols (no T212 needed), HTML to a file, don't write to Supabase
python -m app.run run --symbols AAPL MSFT NVDA --html --out digest.html --dry-run
```

Configuration is entirely via environment variables / `.env`
(see `.env.example`). With no `ANTHROPIC_API_KEY`, the reasoning layer falls
back to a deterministic template rationale, so the pipeline still produces a
digest.

## Backtest (build trust before trusting the rules)

The backtest replays every rule over history and reports, per rule, how often
the signal was followed by a positive move `N` trading days later.

```bash
python -m app.run backtest --symbols AAPL MSFT NVDA AMZN GOOG --horizon 10 --history 750
```

```
Backtest — horizon 10 trading days, 5 symbol(s)
rule                        signals  hit_rate   avg_ret    median
-----------------------------------------------------------------
oversold_bounce                  14     64.3%      1.82%      1.45%
golden_cross_momentum             3     66.7%      3.10%      2.90%
macd_bullish_crossover           41     55.0%      0.61%      0.40%
bollinger_mean_reversion         22     59.1%      0.98%      0.70%
```

(Numbers illustrative.) Forward returns are close-to-close with no costs or
slippage — treat them as research, not P&L.

## The rules

| Rule | Trigger | Strength driver |
|------|---------|-----------------|
| `oversold_bounce` | RSI(14) crosses up through 30 **and** close > SMA200 | depth of oversold + trend cushion |
| `golden_cross_momentum` | SMA50 crosses above SMA200 | MA separation + price confirmation |
| `macd_bullish_crossover` | MACD crosses above signal, **near zero** | proximity to zero (÷ ATR) |
| `bollinger_mean_reversion` | prior close < lower band, then closes back inside | how far it pierced the band |

Each rule returns a boolean + a 0–1 strength. The engine combines triggered
rules into a weighted composite score and attaches key levels and an
ATR-based suggested stop **for context only**.

## Tests

```bash
python -m pytest            # ~60 tests, no network required
python -m pytest --cov=app  # with coverage
```

Synthetic price series deterministically exercise each indicator and each rule
trigger/non-trigger, plus the backtest forward-return math.

## Scheduling

A GitHub Actions workflow (`.github/workflows/daily-signals.yml`) runs the
pipeline Mon–Fri at 22:30 UTC (after the US close), running the tests first and
uploading the digest as an artifact. Configure the secrets referenced in the
workflow. You can also run it any time from the Actions tab (`workflow_dispatch`).

## Swapping the price provider

`app.prices` depends only on the `PriceProvider` interface. To use Alpha
Vantage or Twelve Data, implement `PriceProvider.get_history` and register it
in `app/prices/factory.py`, then set `PRICE_PROVIDER` in `.env`. The parquet
cache wraps any provider transparently.

## Safety notes

- Default base URL is the T212 **demo** host; `Config.is_demo` reflects this.
- The T212 client only issues **GET** requests — there is no code path to place,
  modify, or cancel an order.
- Use a **read-only** API key. Even if a write-capable key were supplied, this
  code never calls a write endpoint.
