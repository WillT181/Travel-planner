-- Signals table for the Swing Trade Signal Agent.
-- Run this in the Supabase SQL editor (or via the CLI) before enabling the
-- Supabase output layer. Writes are performed with the service-role key from
-- the daily job, so RLS is enabled with no public policies by default.

create table if not exists public.signals (
    id             bigint generated always as identity primary key,
    "timestamp"    timestamptz not null default now(),  -- run time (UTC)
    as_of          date,                                -- date of the evaluated bar
    symbol         text        not null,
    composite_score double precision not null,
    triggered_rules jsonb      not null default '[]'::jsonb,   -- array of rule names
    key_levels     jsonb       not null default '{}'::jsonb,   -- {close, sma_50, ...}
    suggested_stop double precision,                    -- ATR-based, context only
    rationale      text
);

create index if not exists signals_symbol_ts_idx
    on public.signals (symbol, "timestamp" desc);

create index if not exists signals_ts_idx
    on public.signals ("timestamp" desc);

-- Enable RLS. The service-role key used by the pipeline bypasses RLS, so no
-- policy is required for the writer. Add SELECT policies here if you later
-- expose this table to authenticated app users.
alter table public.signals enable row level security;
