-- Row Level Security: the database, not the UI, decides who sees what.
--   admin: full access to everything
--   owner: read-only access to their own profile, properties and reservations
--   owner: no access at all to channels (iCal URLs) or sync_events
-- The sync job uses the service role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Helper, kept out of the API-exposed public schema.
-- security definer so it can read profiles without recursing into RLS.
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere and shut out anonymous users entirely.
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.properties   enable row level security;
alter table public.channels     enable row level security;
alter table public.reservations enable row level security;
alter table public.sync_events  enable row level security;

revoke all on public.profiles, public.properties, public.channels,
  public.reservations, public.sync_events from anon;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles: admin writes"
  on public.profiles for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create policy "properties: owner reads own, admin reads all"
  on public.properties for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()));

create policy "properties: admin writes"
  on public.properties for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- channels: admin only. No owner policy exists, so owners get zero rows.
-- ---------------------------------------------------------------------------
create policy "channels: admin only"
  on public.channels for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
create policy "reservations: owner reads own properties, admin reads all"
  on public.reservations for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.properties p
      where p.id = reservations.property_id
        and p.owner_id = (select auth.uid())
    )
  );

create policy "reservations: admin writes"
  on public.reservations for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- sync_events: admin only
-- ---------------------------------------------------------------------------
create policy "sync_events: admin only"
  on public.sync_events for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
