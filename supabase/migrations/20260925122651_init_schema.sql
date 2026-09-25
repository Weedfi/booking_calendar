-- Core schema for the Rental Calendar Portal.
-- Row Level Security policies live in the next migration.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'owner');
create type public.channel_source as enum ('booking', 'airbnb', 'other');
create type public.reservation_status as enum ('active', 'cancelled');
create type public.sync_trigger as enum ('email', 'cron', 'manual');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  role       public.user_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile. The role is always 'owner' here and is
-- never read from user metadata, so nobody can sign themselves up as admin.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table public.properties (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  address             text,
  owner_id            uuid references public.profiles (id) on delete set null,
  color               text not null default '#3b82f6'
                        check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- Booking.com property ID, used to match notification emails to a property.
  booking_property_id text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index properties_owner_id_idx on public.properties (owner_id);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- channels: one iCal feed per property per source. ical_url is a secret.
-- ---------------------------------------------------------------------------
create table public.channels (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete cascade,
  source          public.channel_source not null,
  ical_url        text not null,
  last_synced_at  timestamptz,
  last_sync_error text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Target for the composite FK from reservations.
  unique (id, property_id)
);

create index channels_property_id_idx on public.channels (property_id);

create trigger channels_set_updated_at
  before update on public.channels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reservations: occupied ranges from iCal feeds (bookings and manual blocks).
-- end_date is the checkout day and is exclusive, as in iCal DTEND.
-- ---------------------------------------------------------------------------
create table public.reservations (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null,
  channel_id   uuid not null,
  source       public.channel_source not null,
  external_uid text not null,
  start_date   date not null,
  end_date     date not null,
  summary      text,
  status       public.reservation_status not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (channel_id, external_uid),
  check (end_date > start_date),
  -- Guarantees property_id always matches the channel's property.
  foreign key (channel_id, property_id)
    references public.channels (id, property_id) on delete cascade
);

create index reservations_property_dates_idx
  on public.reservations (property_id, start_date, end_date);

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sync_events: audit log of sync runs (never stores email content).
-- ---------------------------------------------------------------------------
create table public.sync_events (
  id          bigint generated always as identity primary key,
  trigger     public.sync_trigger not null,
  property_id uuid references public.properties (id) on delete set null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  error       text
);

create index sync_events_property_started_idx
  on public.sync_events (property_id, started_at desc);
