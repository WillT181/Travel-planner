-- Itinerary builder: support anonymous-first trips.
-- Run in the Supabase SQL editor after 0008_cities.sql.
--
-- Anonymous visitors build trips entirely client-side (localStorage) and the
-- trip is imported into Supabase when they sign up.  user_id is relaxed to
-- nullable so a future server-side anonymous-session flow can also persist
-- rows before auth; RLS policies still key on auth.uid() = user_id, so a
-- NULL-owner row is readable/writable by no one via the anon key.

alter table public.trips
  alter column user_id drop not null;

-- Fast ordering of activities inside a day section.
create index if not exists activities_day_sort_idx
  on public.activities (trip_day_id, time_of_day, sort_order);
