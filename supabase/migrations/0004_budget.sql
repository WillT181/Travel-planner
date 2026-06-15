-- Budget Tracker (Pro feature): per-trip budget + multi-currency expense log.
-- Also introduces a `plan` column on user_profiles to gate Pro features.
-- Run in the Supabase SQL editor after 0003_trip_planner.sql.

-- ─── Pro plan flag ───────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists plan text not null default 'free'
    constraint plan_values check (plan in ('free', 'pro'));

-- ─── trip_budget ─────────────────────────────────────────────────────────────
-- One row per trip. category_budgets is a { "Category": amount } allocation map.

create table if not exists public.trip_budget (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null unique references public.trips (id) on delete cascade,
  total_budget     numeric(12, 2) not null default 0,
  currency         text not null default 'GBP',
  category_budgets jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trip_budget_set_updated_at on public.trip_budget;
create trigger trip_budget_set_updated_at
  before update on public.trip_budget
  for each row execute function public.set_updated_at();

alter table public.trip_budget enable row level security;

drop policy if exists "Users can view own trip budget" on public.trip_budget;
create policy "Users can view own trip budget"
  on public.trip_budget for select
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

drop policy if exists "Users can insert own trip budget" on public.trip_budget;
create policy "Users can insert own trip budget"
  on public.trip_budget for insert
  with check (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

drop policy if exists "Users can update own trip budget" on public.trip_budget;
create policy "Users can update own trip budget"
  on public.trip_budget for update
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

-- ─── expenses ────────────────────────────────────────────────────────────────

create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips (id) on delete cascade,
  category         text not null
    constraint expense_category_values check (category in (
      'Accommodation', 'Flights', 'Food & drink', 'Transport',
      'Activities', 'Shopping', 'Other'
    )),
  description      text not null,
  amount_local     numeric(12, 2) not null,
  currency_local   text not null default 'GBP',
  amount_gbp       numeric(12, 2) not null,
  date             date not null default current_date,
  added_by_user_id uuid not null references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now()
);

create index if not exists expenses_trip_id_idx on public.expenses (trip_id);
create index if not exists expenses_date_idx on public.expenses (trip_id, date);

alter table public.expenses enable row level security;

drop policy if exists "Users can view own expenses" on public.expenses;
create policy "Users can view own expenses"
  on public.expenses for select
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

drop policy if exists "Users can insert own expenses" on public.expenses;
create policy "Users can insert own expenses"
  on public.expenses for insert
  with check (
    added_by_user_id = auth.uid()
    and exists (
      select 1 from public.trips where id = trip_id and user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own expenses" on public.expenses;
create policy "Users can update own expenses"
  on public.expenses for update
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

drop policy if exists "Users can delete own expenses" on public.expenses;
create policy "Users can delete own expenses"
  on public.expenses for delete
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));
