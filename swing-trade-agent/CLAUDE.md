# Swing Trade Signal Agent — Architecture & Rules for AI Sessions

This document is the contract future sessions must respect when working in
`swing-trade-agent/`. Read it before changing anything.

## What this is

A **decision-support** tool: it identifies swing-trading setups across a
Trading 212 portfolio and writes plain-English rationales. It flags setups for a
human to review. **It does not place trades.**

## Non-negotiable rules

1. **No LLM in the signal math.** All indicator calculations and all signal
   rules are deterministic Python (`app/indicators`, `app/signals`,
   `app/backtest`). The Claude API (`app/reasoning`) is used **only** to turn
   already-computed structured signal data into readable prose. The model must
   never compute, infer, or adjust a number. The system prompt in
   `app/reasoning/claude.py` enforces this — do not weaken it.
2. **No order placement, anywhere.** The Trading 212 client
   (`app/portfolio/t212.py`) issues **GET requests only**. Never add a code
   path that POSTs to an order/position endpoint. There is no "place trade"
   feature and there must never be one.
3. **Demo + read-only by default.** `T212_BASE_URL` defaults to the demo host
   and the app expects a read-only key. Do not change the default to a live
   host.
4. **Secrets only via env / `.env`.** Never hard-code or commit keys.
   `.env` is gitignored; `.env.example` documents every variable.

## Module map

```
app/
  config.py            Config dataclass loaded from env (.env via python-dotenv)
  pipeline.py          Wires the stages together (no trading)
  run.py               CLI: `python -m app.run {run,backtest}`
  agent.py             Interactive tool-using agent REPL (`python -m app.agent`).
                       Tools are THIN wrappers over the modules; screening-only,
                       never trades. Loop/dispatch are pure testable functions.
                       Includes memory/salience tools (get_signal_history /
                       get_recent_changes / get_daily_briefing).
  memory.py            Persistent memory over the Supabase signals table:
                       fetch_timeline(symbol), diff_runs() (latest vs previous),
                       and daily_briefing() — an ORGANISED salience bundle (new/
                       persisting/resolved/expired/anomalies + quiet_day flag).
                       Judgment/ranking stays in the agent prompt; the assembler
                       only supplies data. write_signals stamps one timestamp per
                       run so runs group cleanly; empty/first-run handled.
  portfolio/t212.py    READ-ONLY Trading 212 client (GET /equity/portfolio,
                       Basic auth, 429 retry/backoff) + symbol mapping
  prices/              PriceProvider interface, yfinance impl (>=250 days),
                       parquet cache keyed by symbol+date, factory
  news/                NewsProvider interface + Finnhub free-tier impl + factory
                       (agent get_news / get_upcoming_events context; factual
                       data only, key from env, degrades gracefully)
  indicators/compute.py  add_indicators(df): RSI/MACD/SMA/EMA/Bollinger/ATR/
                       vol-SMA via pandas-ta-classic (deterministic)
  signals/
    models.py          RuleResult, Signal dataclasses (the LLM's only input)
    rules.py           The five swing setups; each returns bool + 0-1 strength
    engine.py          Aggregates rules -> composite score (+ confirmation
                       bonus), levels, ATR stop; isolates raising rules;
                       validates input frame (REQUIRED_COLUMNS, >=2 rows)
  backtest/harness.py  run_backtest: walk-forward (NO lookahead) -> per-rule
                       hit-rate/return at +5/+10/+20 vs a buy-and-hold baseline
  reasoning/claude.py  Claude narration only (explain_signal / explain_signals,
                       threshold-filtered) + deterministic fallback. Uses
                       claude-opus-4-8 with output_config effort=low — NO
                       temperature (that model 400s on sampling params)
  output/              Supabase writer, markdown/HTML digest, Resend email
tests/                 ~60 pytest tests; synthetic series, no network
```

## Data contracts

- **OHLCV frame:** lowercase columns `open, high, low, close, volume`, ascending
  `DatetimeIndex`. `app.prices.normalize_ohlcv` is the single normaliser.
- **Indicator frame:** OHLCV plus the columns in
  `app.indicators.INDICATOR_COLUMNS`.
- **Rule:** `Callable[[pd.DataFrame], RuleResult]` evaluated at the **last row**
  of the frame (earlier rows only for crossover context). This is what lets the
  backtest replay a rule by slicing `df.iloc[: i + 1]`. `engine.evaluate_rules`
  runs each rule in a try/except so a single broken rule cannot abort the
  symbol; `engine.confirmation_bonus` adds a small capped reward when multiple
  rules trigger together.
- **Signal:** `{symbol, direction, composite_score, triggered_rules[],
  key_levels{}, suggested_stop, atr, as_of}` — the *only* object handed to the
  reasoning layer, via `Signal.to_dict()`.

## Adding a rule

1. Write a pure function in `app/signals/rules.py` returning a `RuleResult`
   (guard for insufficient rows / NaNs; clamp strength to 0–1).
2. Add it to the `RULES` registry and give it a weight in
   `engine.RULE_WEIGHTS`.
3. Add trigger **and** non-trigger unit tests in `tests/test_signals.py` using
   hand-built indicator frames (see `indicator_frame` in `conftest.py`).
4. **Backtest it** before trusting it (`python -m app.run backtest`). The
   backtest exists so rules are validated on history, not vibes.

## Indicators note

Indicators are computed by `pandas-ta-classic` (with `numba`), both **core
dependencies**. The public entrypoint is `app.indicators.add_indicators(df)`:
it takes a raw OHLCV frame and returns a copy with exactly the columns in
`INDICATOR_COLUMNS` appended — which line up with `app.signals.REQUIRED_COLUMNS`.
`compute_indicators` is kept as a backward-compatible alias for `add_indicators`.

Invariants (enforced by `tests/test_indicators.py`): input is never mutated (a
copy is returned), the row count is unchanged, warmup rows hold `NaN` rather
than being dropped (the backtest relies on date alignment), and short/empty
input yields all-`NaN` columns rather than raising. This is still deterministic
Python maths — the "no LLM in indicator/signal math" rule is unchanged.

## Testing

`python -m pytest` must stay green and network-free. Every rule needs a
trigger and a non-trigger test; indicator changes need a numeric assertion.
