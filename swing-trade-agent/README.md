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
| `app.reasoning` | Claude narrates signal JSON → rationale (`explain_signal` / threshold-filtered `explain_signals`); prose only, never computes | No |
| `app.agent` | Interactive REPL: a tool-using Claude agent that wraps the modules as tools (`python -m app.agent`) | No |
| `app.memory` | Persistent memory over the Supabase `signals` table: a symbol's timeline + run-to-run diff | No |
| `app.news` | Swappable free-tier news/events provider (Finnhub) for agent context — factual headlines + earnings dates | No |
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

Fill in `.env` — every variable is listed in `.env.example`. The only one
required to run against demo is a **read-only** `T212_API_KEY`; everything else
(Anthropic, Supabase, Resend) is optional and the pipeline degrades gracefully
when it's unset.

### Optional: Supabase persistence

To store each run's signals, create the table once, then set `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`:

```bash
# Run supabase/0001_signals.sql in the Supabase SQL editor (or via the CLI).
# Columns: timestamp, symbol, as_of, composite_score, triggered_rules (jsonb),
#          key_levels (jsonb), suggested_stop, rationale.
```

If Supabase isn't configured the writer is a no-op (returns 0) — the run still
prints/writes the digest.

## Run against the demo portfolio

`python -m app.run` runs the full pipeline in order: **fetch portfolio → fetch
prices → add indicators → evaluate signals → reason over above-threshold
signals → write output**, logging each stage. A failure on one symbol is logged
and skipped, never aborting the run.

```bash
# Full pipeline: T212 demo portfolio → signals → rationale → markdown digest
python -m app.run                       # (the `run` subcommand is the default)

# Write the digest to a file
python -m app.run --out digest.md

# Explicit symbols (no T212 call), dry run (no Supabase write / no email), HTML
python -m app.run --symbols AAPL MSFT NVDA --dry-run --html --out digest.html
```

Configuration is entirely via environment variables / `.env`
(see `.env.example`). With no `ANTHROPIC_API_KEY`, the reasoning layer falls
back to a deterministic template rationale, so the pipeline still produces a
digest. Email delivery is **opt-in**: the digest is emailed via Resend only when
`RESEND_API_KEY`, `DIGEST_FROM`, and `DIGEST_TO` are all set.

## Chat with the agent

`python -m app.agent` opens a terminal REPL where a tool-using Claude agent
(`claude-opus-4-8`) can call the pipeline on your behalf:

```
you> what do I hold, and does anything look interesting today?
agent> ...calls get_portfolio + get_signals, then explains the setups...
```

Tools (each a thin wrapper over an existing module, never reimplementing logic):
`get_portfolio`, `get_signals` (reads the Supabase `signals` table, falls back
to live evaluation), `explain_signal`, `get_price_history`, `run_backtest`, and
three **memory / salience** tools backed by the stored `signals` history —
`get_signal_history` (a symbol's past reports in date order), `get_recent_changes`
(what's new / newly triggered / stopped since the previous run), and
`get_daily_briefing` (today's signals organised into new triggers, persisting
setups, resolved/expired setups, and anomalies — plus a `quiet_day` flag). The
briefing tool returns **organised data, not prose**: the agent ranks it (by
composite score **and** novelty) and writes the briefing, leading with what
changed or is unusual and saying plainly when it's a quiet day.

It can also pull **external context** to reason like an analyst: `get_news`
(recent factual headlines — title/source/date, not full articles) and
`get_upcoming_events` (near-term earnings dates), behind a swappable free-tier
provider (Finnhub; set `NEWS_API_KEY`, or the tools return "no data"). The agent
attributes such context to the tool result, never treats a headline as a trade
recommendation, and won't infer causation beyond the data.

The agent reasons only from tool output, uses memory for temporal context (e.g.
a setup persisting for days), never invents numbers, and **declines to trade or
give advice** — it is screening-only. A tool error is returned to the model as a
string, so the loop never crashes. Needs `ANTHROPIC_API_KEY`; type `exit` to quit.

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
python -m pytest            # ~165 tests, no network required (HTTP/LLM mocked)
python -m pytest --cov=app  # with coverage
```

Synthetic price series deterministically exercise each indicator and each rule
trigger/non-trigger, the backtest forward-return math, and an **end-to-end smoke
test** (`tests/test_smoke.py`) that runs the whole pipeline against the T212
demo (mocked HTTP) with mocked price data.

## Scheduling

A GitHub Actions workflow (`.github/workflows/daily-signals.yml`) runs
`python -m app.run` **Mon–Fri at 21:30 UTC** (after the US close), running the
tests first and uploading the markdown digest as an artifact. Trigger it any
time from the Actions tab (`workflow_dispatch`).

Set these in the repo's **Settings → Secrets and variables → Actions**:

| Secret | Needed for |
|--------|-----------|
| `T212_API_KEY` (+ optional `T212_API_SECRET`, `T212_BASE_URL`) | portfolio fetch |
| `ANTHROPIC_API_KEY` | LLM rationales (falls back to templates if unset) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | persisting signals (optional) |
| `RESEND_API_KEY`, `DIGEST_FROM`, `DIGEST_TO` | emailing the digest (optional) |

Plus an optional **variable** `SIGNAL_THRESHOLD`. Leave a secret unset and its
stage no-ops — only `T212_API_KEY` is needed for a minimal demo run.

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
