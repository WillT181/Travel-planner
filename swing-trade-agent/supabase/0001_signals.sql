-- Signals table for the Swing Trade Signal Agent.
-- Run this in the Supabase SQL editor (or via the CLI) before enabling the
-- Supabase output layer. Writes are performed with the service-role key from
-- the daily job, so RLS is enabled with no public policies by default.

create table if not exists public.signals (
    id             bigint generated always as identity primary key,
    generated_at   timestamptz not null default now(),
    as_of          date,
    symbol         text        not null,
    direction      text        not null check (direction in ('long', 'neutral', 'short')),
    score          double precision not null,
    rules          text[]      not null default '{}',
    key_levels     jsonb       not null default '{}'::jsonb,
    suggested_stop double precision,
    atr            double precision,
    rationale      text
);

create index if not exists signals_symbol_generated_idx
    on public.signals (symbol, generated_at desc);

create index if not exists signals_generated_idx
    on public.signals (generated_at desc);

-- Enable RLS. The service-role key used by the pipeline bypasses RLS, so no
-- policy is required for the writer. Add SELECT policies here if you later
-- expose this table to authenticated app users.
alter table public.signals enable row level security;
