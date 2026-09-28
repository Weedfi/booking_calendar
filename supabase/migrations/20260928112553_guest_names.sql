-- Guest names, entered by the admin or read from Booking.com notification
-- emails. The iCal feed has no guest data, so names live in their own table.
--
-- A name is attached to an apartment and stay dates, not to a feed row:
-- the email can arrive before Booking.com updates the feed, and Booking.com
-- may merge back-to-back stays into one block. The UI shows every name whose
-- dates fall inside a reservation.
--
-- Visible to the admin and to the owner of the apartment (product decision);
-- only the admin can change them. Names are kept until deleted by the admin.

create type public.guest_name_source as enum ('manual', 'email');

create table public.guest_stays (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  guest_name  text not null check (length(btrim(guest_name)) between 1 and 200),
  source      public.guest_name_source not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date > start_date),
  unique (property_id, start_date, end_date)
);

create index guest_stays_property_dates_idx on public.guest_stays (property_id, start_date, end_date);

create trigger guest_stays_set_updated_at
  before update on public.guest_stays
  for each row execute function public.set_updated_at();

alter table public.guest_stays enable row level security;
revoke all on public.guest_stays from anon;

create policy "guest_stays: owner reads own properties, admin reads all"
  on public.guest_stays for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.properties p
      where p.id = guest_stays.property_id
        and p.owner_id = (select auth.uid())
    )
  );

create policy "guest_stays: admin writes"
  on public.guest_stays for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
