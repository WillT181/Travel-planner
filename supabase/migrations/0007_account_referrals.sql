-- Account settings (display name, currency preference) + referral programme.
-- Run in the Supabase SQL editor after 0006_stripe_billing.sql.

-- ─── user_profiles additions ─────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists display_name  text,
  add column if not exists currency      text not null default 'GBP',
  add column if not exists referral_code text;

-- Each referral code is unique across all users.
create unique index if not exists user_profiles_referral_code_idx
  on public.user_profiles (referral_code)
  where referral_code is not null;

-- Generate a random, human-friendly 8-char code (no ambiguous 0/O/1/I/L chars).
create or replace function public.gen_referral_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code     text;
  i        int;
  taken    boolean;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select exists(select 1 from public.user_profiles where referral_code = code)
      into taken;
    exit when not taken;
  end loop;
  return code;
end;
$$;

-- Backfill codes for users who signed up before the programme existed.
update public.user_profiles
  set referral_code = public.gen_referral_code()
  where referral_code is null;

-- New users get a referral code at sign-up (extends the 0006 trigger fn).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, referral_code)
  values (new.id, public.gen_referral_code())
  on conflict (id) do nothing;
  return new;
end;
$$;
-- (the on_auth_user_created trigger from 0006 already invokes this function)

-- ─── referrals ────────────────────────────────────────────────────────────────

create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_id       uuid not null references auth.users (id) on delete cascade,
  referred_user_id  uuid not null references auth.users (id) on delete cascade,
  referred_email    text,
  status            text not null default 'pending'
                      check (status in ('pending', 'completed', 'rewarded')),
  reward_granted_at timestamptz,
  created_at        timestamptz not null default now(),
  unique (referred_user_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

-- Referrers see who they referred; the referred user can see their own row.
drop policy if exists "View own referrals" on public.referrals;
create policy "View own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_user_id);

-- record_referral: the freshly-signed-up user attaches themselves to a referrer.
-- SECURITY DEFINER so it can read another user's referral_code (which RLS hides)
-- without exposing the whole profile. Self-referral and double-referral are
-- rejected. Returns true only when a new pending row was created.
create or replace function public.record_referral(_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  _me       uuid := auth.uid();
  _referrer uuid;
  _email    text;
begin
  if _me is null or _code is null or btrim(_code) = '' then
    return false;
  end if;

  select id into _referrer
    from public.user_profiles
    where referral_code = upper(btrim(_code));

  if _referrer is null or _referrer = _me then
    return false;
  end if;

  if exists (select 1 from public.referrals where referred_user_id = _me) then
    return false;
  end if;

  select email into _email from auth.users where id = _me;

  insert into public.referrals (referrer_id, referred_user_id, referred_email, status)
    values (_referrer, _me, _email, 'pending')
    on conflict (referred_user_id) do nothing;

  return true;
end;
$$;

-- complete_referral: called when the referred user finishes onboarding. Flips a
-- pending row to 'completed' and returns the referrer's id so the caller can
-- grant the reward (returns null when there's nothing to complete).
create or replace function public.complete_referral()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _me       uuid := auth.uid();
  _referrer uuid;
begin
  if _me is null then
    return null;
  end if;

  update public.referrals
    set status = 'completed'
    where referred_user_id = _me and status = 'pending'
    returning referrer_id into _referrer;

  return _referrer;
end;
$$;

grant execute on function public.record_referral(text) to authenticated;
grant execute on function public.complete_referral() to authenticated;
