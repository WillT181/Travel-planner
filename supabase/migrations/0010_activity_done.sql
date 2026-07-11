-- "Tick it off" — activities can be marked done in the itinerary builder
-- (Wanderly Builder design). Run in the Supabase SQL editor after
-- 0009_itinerary_anon.sql.

alter table public.activities
  add column if not exists done boolean not null default false;
