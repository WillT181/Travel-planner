-- trips: a user's planned trips, created from the destination explorer.
-- Run in the Supabase SQL editor or via the Supabase CLI.

create table if not exists public.trips (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  destination_slug text not null,
  destination_name text,
  country          text,
  created_at       timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id);

-- Row Level Security: a user may only read/write their own trips.
alter table public.trips enable row level security;

drop policy if exists "Users can view own trips" on public.trips;
create policy "Users can view own trips"
  on public.trips for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own trips" on public.trips;
create policy "Users can insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own trips" on public.trips;
create policy "Users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);
