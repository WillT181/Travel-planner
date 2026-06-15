-- Extend trips with planning metadata and add trip_days + activities tables.
-- Run in the Supabase SQL editor after 0002_trips.sql.

-- ─── Extend trips ────────────────────────────────────────────────────────────

alter table public.trips
  add column if not exists title           text,
  add column if not exists start_date      date,
  add column if not exists end_date        date,
  add column if not exists traveller_count smallint not null default 1
    constraint traveller_count_positive check (traveller_count >= 1),
  add column if not exists status          text not null default 'planning'
    constraint status_values check (status in ('planning', 'booked', 'completed'));

drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id);

-- ─── trip_days ───────────────────────────────────────────────────────────────

create table if not exists public.trip_days (
  id          uuid     primary key default gen_random_uuid(),
  trip_id     uuid     not null references public.trips (id) on delete cascade,
  day_number  smallint not null,
  date        date,
  label       text,
  created_at  timestamptz not null default now(),
  unique (trip_id, day_number)
);

create index if not exists trip_days_trip_id_idx on public.trip_days (trip_id);

alter table public.trip_days enable row level security;

drop policy if exists "Users can view own trip days" on public.trip_days;
create policy "Users can view own trip days"
  on public.trip_days for select
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

drop policy if exists "Users can insert own trip days" on public.trip_days;
create policy "Users can insert own trip days"
  on public.trip_days for insert
  with check (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

drop policy if exists "Users can update own trip days" on public.trip_days;
create policy "Users can update own trip days"
  on public.trip_days for update
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

drop policy if exists "Users can delete own trip days" on public.trip_days;
create policy "Users can delete own trip days"
  on public.trip_days for delete
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));

-- ─── activities ──────────────────────────────────────────────────────────────

create table if not exists public.activities (
  id            uuid    primary key default gen_random_uuid(),
  trip_day_id   uuid    not null references public.trip_days (id) on delete cascade,
  time_of_day   text    not null
    constraint time_of_day_values check (time_of_day in ('morning', 'afternoon', 'evening')),
  title         text    not null,
  notes         text,
  duration_mins integer constraint duration_positive check (duration_mins >= 0),
  cost          numeric(10, 2),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists activities_trip_day_id_idx on public.activities (trip_day_id);

alter table public.activities enable row level security;

drop policy if exists "Users can view own activities" on public.activities;
create policy "Users can view own activities"
  on public.activities for select
  using (exists (
    select 1 from public.trip_days td
    join public.trips t on t.id = td.trip_id
    where td.id = trip_day_id and t.user_id = auth.uid()
  ));

drop policy if exists "Users can insert own activities" on public.activities;
create policy "Users can insert own activities"
  on public.activities for insert
  with check (exists (
    select 1 from public.trip_days td
    join public.trips t on t.id = td.trip_id
    where td.id = trip_day_id and t.user_id = auth.uid()
  ));

drop policy if exists "Users can update own activities" on public.activities;
create policy "Users can update own activities"
  on public.activities for update
  using (exists (
    select 1 from public.trip_days td
    join public.trips t on t.id = td.trip_id
    where td.id = trip_day_id and t.user_id = auth.uid()
  ));

drop policy if exists "Users can delete own activities" on public.activities;
create policy "Users can delete own activities"
  on public.activities for delete
  using (exists (
    select 1 from public.trip_days td
    join public.trips t on t.id = td.trip_id
    where td.id = trip_day_id and t.user_id = auth.uid()
  ));
