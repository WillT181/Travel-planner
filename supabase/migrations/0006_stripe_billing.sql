-- Stripe billing: link user_profiles to a Stripe customer + subscription.
-- Run in the Supabase SQL editor after 0005_collaboration.sql.
--
-- The `plan` column already exists (0004). Webhook handlers (running with the
-- service-role key) flip it between 'free' and 'pro'.

alter table public.user_profiles
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text;

create index if not exists user_profiles_stripe_customer_idx
  on public.user_profiles (stripe_customer_id);

-- A profile row may not exist yet for users who skipped onboarding. Ensure one
-- is created on sign-up so billing has somewhere to store the customer id.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
