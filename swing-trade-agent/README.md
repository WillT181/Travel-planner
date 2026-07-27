# Swing Trade Signal Agent

A Python **decision-support** tool that scans the stocks in your Trading 212
portfolio for swing-trading setups and writes plain-English rationales for each
one.

> ⚠️ **This tool does not trade.** It flags setups for *you* to review. There
> is no order-placement code anywhere in this repository. It runs against the
> Trading 212 **demo** environment with a **read-only** API key by default.

## How it works

```
Trading 212        yfinance        pandas-ta-classic    rules engine
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
| `app.portfolio` | Read-only Trading 212 positions (`GET /equity/portfolio`, Basic auth, 429-aware) → clean symbols | No (GET only) |
| `app.prices` | Daily OHLCV (≥250 days) via a swappable `PriceProvider`, parquet-cached by symbol+date | No |
| `app.indicators` | `add_indicators(df)`: RSI, MACD, SMA/EMA, Bollinger, ATR, volume SMA (pandas-ta-classic) | No |
| `app.signals` | Rules engine → per-symbol `Signal` (score, levels, stop) | No |
| `app.backtest` | `run_backtest`: walk-forward, no lookahead → per-rule hit-rate/return vs buy-and-hold, at +5/+10/+20 | No |
| `app.reasoning` | Claude turns signal JSON → rationale (prose only) | No |
| `app.output` | Supabase writer + markdown/HTML digest + email | No |

## Setup

```bash
cd swing-trade-agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # or: pip install -e ".[dev,prices,reasoning,output]"
cp .env.example .env                      # then fill in a READ-ONLY demo key
```

Only `pandas`, `numpy`, `pandas-ta-classic`, `numba`, `requests`,
`python-dotenv` are required for the trust-critical core
(indicators/signals/backtest) and the tests. The rest (`yfinance`, `anthropic`,
`supabase`) are needed for live data, reasoning and persistence respectively.

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

The backtest walks forward bar by bar. At each bar it evaluates the rules on
**only** the data up to and including that bar (the slice `indicators.iloc[:i+1]`
— future rows are physically absent, so there is no lookahead), and whenever a
rule fires it records the forward return of `close` at each horizon (default
+5/+10/+20 trading days), skipping triggers too close to the end to have a full
window. Per rule it reports trigger count, hit-rate, and mean/median forward
return at each horizon — plus a **buy-and-hold baseline** over the identical set
of entry bars, so you can see whether a rule actually beats just holding.

```bash
python -m app.run backtest --symbols AAPL MSFT NVDA AMZN GOOG --horizons 5 10 20 --history 750
```

```
Backtest — 5 symbol(s): AAPL, AMZN, GOOG, MSFT, NVDA
Horizons (trading days): 5, 10, 20
(forward returns are close-to-close, no costs; decision support only)

rule                      trig    +5 hit     mean      med   +10 hit     mean      med   +20 hit     mean      med
------------------------------------------------------------------------------------------------------------------
golden_cross_momentum        4    100.0%    2.9%     2.9%     100.0%    5.8%     5.8%     100.0%   11.7%   11.7%
oversold_bounce             14     64.3%    1.8%     1.5%      61.0%    2.1%     1.7%      57.0%    2.4%    1.9%
...
------------------------------------------------------------------------------------------------------------------
buy_and_hold (baseline)    947     37.2%   -0.2%     0.0%      35.9%   -0.3%     0.0%      33.4%   -0.5%    0.0%
```

(Numbers illustrative.) A rule earns its keep only if it clears the
`buy_and_hold` row. Forward returns are close-to-close with no costs or
slippage — treat them as research, not P&L.

Programmatically: `run_backtest(price_data, horizons=(5, 10, 20)) ->
BacktestReport` (and `format_report(report)` for the table above).

## The rules

| Rule | Trigger | Strength driver |
|------|---------|-----------------|
| `oversold_bounce` | RSI(14) crosses up through 30 **and** close > SMA200 | depth of oversold + trend cushion |
| `golden_cross_momentum` | SMA50 crosses above SMA200 | MA separation + price **and volume** confirmation |
| `macd_bullish_crossover` | MACD crosses above signal, **near zero** | proximity to zero (÷ ATR) |
| `bollinger_mean_reversion` | prior close < lower band, then closes back inside (**vetoed if SMA50 is falling**) | how far it pierced the band |
| `ema_pullback_resume` | in an EMA20>EMA50 uptrend, price dipped to EMA20 then reclaimed it | EMA20/EMA50 separation |

Each rule returns a boolean + a 0–1 strength. The engine combines triggered
rules into a **weighted composite score** (weighted mean of triggered
strengths) plus a small **confirmation bonus** when several independent rules
agree, and attaches key levels and an ATR-based suggested stop **for context
only**. Rules are evaluated in isolation — a rule that raises is recorded as a
non-trigger with an error note rather than aborting the symbol. `build_signal`
validates its input up front (`REQUIRED_COLUMNS`, ≥2 rows) and raises on a
malformed frame rather than silently scoring zero.

## Tests

```bash
python -m pytest            # ~115 tests, no network required (HTTP is mocked)
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
