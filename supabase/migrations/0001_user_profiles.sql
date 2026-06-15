-- user_profiles: onboarding answers + per-user travel preferences.
-- Run in the Supabase SQL editor or via the Supabase CLI.

create table if not exists public.user_profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  first_trip_destination text,
  trip_start_date        date,
  trip_end_date          date,
  travel_companions      text check (
                           travel_companions in ('solo', 'couple', 'family', 'group')
                         ),
  budget                 integer check (budget >= 0),
  onboarded_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Keep updated_at current on every write.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- Row Level Security: a user may only read/write their own profile row.
alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
