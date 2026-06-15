-- Trip collaboration: members, invites, roles, ownership transfer, realtime.
-- Run in the Supabase SQL editor after 0004_budget.sql.
--
-- Design notes
-- ------------
-- * trips.user_id remains the canonical owner.
-- * trip_members holds every participant (owner included, via trigger).
-- * Role checks use SECURITY DEFINER helper functions so RLS policies that
--   reference trip_members / trips don't recurse on themselves.

-- ─── trip_members ────────────────────────────────────────────────────────────

create table if not exists public.trip_members (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  email          text,
  role           text not null default 'viewer'
                   check (role in ('owner', 'editor', 'viewer')),
  edit_requested boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index if not exists trip_members_trip_idx on public.trip_members (trip_id);
create index if not exists trip_members_user_idx on public.trip_members (user_id);

-- ─── trip_invites ────────────────────────────────────────────────────────────

create table if not exists public.trip_invites (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  invited_email text not null,
  role          text not null default 'viewer' check (role in ('editor', 'viewer')),
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined')),
  token         uuid not null default gen_random_uuid() unique,
  invited_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists trip_invites_trip_idx on public.trip_invites (trip_id);
create index if not exists trip_invites_token_idx on public.trip_invites (token);

-- ─── Helper functions (SECURITY DEFINER avoids RLS recursion) ────────────────

create or replace function public.is_trip_member(_trip_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from trips t where t.id = _trip_id and t.user_id = auth.uid())
      or exists (select 1 from trip_members m
                 where m.trip_id = _trip_id and m.user_id = auth.uid());
$$;

create or replace function public.trip_role(_trip_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select case
    when exists (select 1 from trips t where t.id = _trip_id and t.user_id = auth.uid())
      then 'owner'
    else (select m.role from trip_members m
          where m.trip_id = _trip_id and m.user_id = auth.uid() limit 1)
  end;
$$;

create or replace function public.can_edit_trip(_trip_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.trip_role(_trip_id) in ('owner', 'editor');
$$;

create or replace function public.trip_id_for_day(_day_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select trip_id from trip_days where id = _day_id;
$$;

-- ─── Auto-add the owner as a member on trip creation ─────────────────────────

create or replace function public.handle_new_trip()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id, email, role)
  values (new.id, new.user_id,
          (select email from auth.users where id = new.user_id), 'owner')
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trips_add_owner_member on public.trips;
create trigger trips_add_owner_member
  after insert on public.trips
  for each row execute function public.handle_new_trip();

-- Backfill owner memberships for trips that pre-date this migration.
insert into public.trip_members (trip_id, user_id, email, role)
select t.id, t.user_id, u.email, 'owner'
from public.trips t
join auth.users u on u.id = t.user_id
on conflict (trip_id, user_id) do nothing;

-- ─── Invite accept / decline / preview / transfer RPCs ───────────────────────

create or replace function public.accept_trip_invite(_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv record; uid uuid; uemail text;
begin
  uid := auth.uid();
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into inv from trip_invites where token = _token;
  if inv is null then raise exception 'INVITE_NOT_FOUND'; end if;
  if inv.status <> 'pending' then raise exception 'INVITE_NOT_PENDING'; end if;

  select email into uemail from auth.users where id = uid;
  if uemail is null or lower(uemail) <> lower(inv.invited_email) then
    raise exception 'EMAIL_MISMATCH';
  end if;

  insert into trip_members (trip_id, user_id, email, role)
  values (inv.trip_id, uid, uemail, inv.role)
  on conflict (trip_id, user_id) do update set role = excluded.role;

  update trip_invites set status = 'accepted' where id = inv.id;
  return inv.trip_id;
end;
$$;

create or replace function public.decline_trip_invite(_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv record; uemail text;
begin
  select * into inv from trip_invites where token = _token;
  if inv is null then raise exception 'INVITE_NOT_FOUND'; end if;

  select email into uemail from auth.users where id = auth.uid();
  if uemail is null or lower(uemail) <> lower(inv.invited_email) then
    raise exception 'EMAIL_MISMATCH';
  end if;

  update trip_invites set status = 'declined'
  where id = inv.id and status = 'pending';
end;
$$;

create or replace function public.invite_details(_token uuid)
returns table (
  trip_id         uuid,
  destination_name text,
  inviter_email   text,
  role            text,
  status          text,
  invited_email   text
)
language sql security definer stable set search_path = public as $$
  select i.trip_id, t.destination_name, u.email, i.role, i.status, i.invited_email
  from trip_invites i
  join trips t on t.id = i.trip_id
  left join auth.users u on u.id = i.invited_by
  where i.token = _token;
$$;

create or replace function public.transfer_trip_ownership(_trip_id uuid, _new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cur uuid;
begin
  cur := auth.uid();
  if not exists (select 1 from trips where id = _trip_id and user_id = cur) then
    raise exception 'NOT_OWNER';
  end if;
  if not exists (select 1 from trip_members
                 where trip_id = _trip_id and user_id = _new_owner) then
    raise exception 'NOT_A_MEMBER';
  end if;

  update trips set user_id = _new_owner where id = _trip_id;
  update trip_members set role = 'owner', edit_requested = false
    where trip_id = _trip_id and user_id = _new_owner;
  insert into trip_members (trip_id, user_id, email, role)
    values (_trip_id, cur, (select email from auth.users where id = cur), 'editor')
    on conflict (trip_id, user_id) do update set role = 'editor';
end;
$$;

grant execute on function public.invite_details(uuid) to anon, authenticated;
grant execute on function public.accept_trip_invite(uuid) to authenticated;
grant execute on function public.decline_trip_invite(uuid) to authenticated;
grant execute on function public.transfer_trip_ownership(uuid, uuid) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.trip_role(uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid) to authenticated;
grant execute on function public.trip_id_for_day(uuid) to authenticated;

-- ─── RLS: trip_members ───────────────────────────────────────────────────────

alter table public.trip_members enable row level security;

drop policy if exists "view members" on public.trip_members;
create policy "view members" on public.trip_members for select
  using (public.is_trip_member(trip_id));

drop policy if exists "owner manage members" on public.trip_members;
create policy "owner manage members" on public.trip_members for all
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));

drop policy if exists "update own membership" on public.trip_members;
create policy "update own membership" on public.trip_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "leave trip" on public.trip_members;
create policy "leave trip" on public.trip_members for delete
  using (user_id = auth.uid());

-- ─── RLS: trip_invites ───────────────────────────────────────────────────────

alter table public.trip_invites enable row level security;

drop policy if exists "owner view invites" on public.trip_invites;
create policy "owner view invites" on public.trip_invites for select
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));

drop policy if exists "owner create invites" on public.trip_invites;
create policy "owner create invites" on public.trip_invites for insert
  with check (
    invited_by = auth.uid()
    and exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
  );

drop policy if exists "owner delete invites" on public.trip_invites;
create policy "owner delete invites" on public.trip_invites for delete
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));

-- ─── RLS: trips (members can view, owner mutates) ────────────────────────────

drop policy if exists "Users can view own trips" on public.trips;
drop policy if exists "Users can insert own trips" on public.trips;
drop policy if exists "Users can update own trips" on public.trips;
drop policy if exists "Users can delete own trips" on public.trips;

create policy "members can view trips" on public.trips for select
  using (public.is_trip_member(id));
create policy "users insert own trips" on public.trips for insert
  with check (user_id = auth.uid());
create policy "owner update trips" on public.trips for update
  using (user_id = auth.uid());
create policy "owner delete trips" on public.trips for delete
  using (user_id = auth.uid());

-- ─── RLS: trip_days (members view, editors mutate) ───────────────────────────

drop policy if exists "Users can view own trip days" on public.trip_days;
drop policy if exists "Users can insert own trip days" on public.trip_days;
drop policy if exists "Users can update own trip days" on public.trip_days;
drop policy if exists "Users can delete own trip days" on public.trip_days;

create policy "members view days" on public.trip_days for select
  using (public.is_trip_member(trip_id));
create policy "editors insert days" on public.trip_days for insert
  with check (public.can_edit_trip(trip_id));
create policy "editors update days" on public.trip_days for update
  using (public.can_edit_trip(trip_id));
create policy "editors delete days" on public.trip_days for delete
  using (public.can_edit_trip(trip_id));

-- ─── RLS: activities (members view, editors mutate) ──────────────────────────

drop policy if exists "Users can view own activities" on public.activities;
drop policy if exists "Users can insert own activities" on public.activities;
drop policy if exists "Users can update own activities" on public.activities;
drop policy if exists "Users can delete own activities" on public.activities;

create policy "members view activities" on public.activities for select
  using (public.is_trip_member(public.trip_id_for_day(trip_day_id)));
create policy "editors insert activities" on public.activities for insert
  with check (public.can_edit_trip(public.trip_id_for_day(trip_day_id)));
create policy "editors update activities" on public.activities for update
  using (public.can_edit_trip(public.trip_id_for_day(trip_day_id)));
create policy "editors delete activities" on public.activities for delete
  using (public.can_edit_trip(public.trip_id_for_day(trip_day_id)));

-- ─── Realtime: broadcast row changes for live collaboration ──────────────────

do $$ begin
  alter publication supabase_realtime add table public.activities;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.trip_days;
exception when duplicate_object then null; end $$;
