-- Demo seed data. Everything here is fake. Never put real iCal URLs or guest data here.
-- Reservation dates are relative to current_date, so the demo always looks current.
--
-- Local login: request a magic link for any address below, then open it from
-- Mailpit at http://127.0.0.1:54324.
--   admin@example.com    (admin)
--   anna@example.com     (owner, 6 properties)
--   marek@example.com    (owner, 5 properties)
--   julia@example.com    (owner, 4 properties)

-- ---------------------------------------------------------------------------
-- Users. The on_auth_user_created trigger creates a matching profile row.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@example.com', 'Demo Manager'),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'anna@example.com',  'Anna Nowak'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'marek@example.com', 'Marek Kowalski'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'julia@example.com', 'Julia Wiśniewska')
) as u (id, email, full_name);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%@example.com';

update public.profiles set role = 'admin'
where id = 'a0000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------
insert into public.properties (id, name, address, owner_id, color, booking_property_id)
values
  ('c0000000-0000-4000-8000-000000000001', 'Old Town Loft',         'ul. Floriańska 12, Kraków',  'b0000000-0000-4000-8000-000000000001', '#ef4444', '1000001'),
  ('c0000000-0000-4000-8000-000000000002', 'Kazimierz Studio',      'ul. Szeroka 5, Kraków',      'b0000000-0000-4000-8000-000000000001', '#f97316', '1000002'),
  ('c0000000-0000-4000-8000-000000000003', 'Wawel View Apartment',  'ul. Bernardyńska 3, Kraków', 'b0000000-0000-4000-8000-000000000001', '#f59e0b', '1000003'),
  ('c0000000-0000-4000-8000-000000000004', 'Podgórze Riverside',    'ul. Nadwiślańska 8, Kraków', 'b0000000-0000-4000-8000-000000000001', '#84cc16', '1000004'),
  ('c0000000-0000-4000-8000-000000000005', 'Market Square Suite',   'Rynek Główny 20, Kraków',    'b0000000-0000-4000-8000-000000000001', '#22c55e', '1000005'),
  ('c0000000-0000-4000-8000-000000000006', 'Planty Garden Flat',    'ul. Basztowa 9, Kraków',     'b0000000-0000-4000-8000-000000000001', '#10b981', '1000006'),
  ('c0000000-0000-4000-8000-000000000007', 'Nowa Huta Retro',       'os. Centrum A 1, Kraków',    'b0000000-0000-4000-8000-000000000002', '#14b8a6', '1000007'),
  ('c0000000-0000-4000-8000-000000000008', 'Zabłocie Industrial',   'ul. Lipowa 4, Kraków',       'b0000000-0000-4000-8000-000000000002', '#06b6d4', '1000008'),
  ('c0000000-0000-4000-8000-000000000009', 'Salwator Hideaway',     'ul. Anczyca 2, Kraków',      'b0000000-0000-4000-8000-000000000002', '#0ea5e9', '1000009'),
  ('c0000000-0000-4000-8000-000000000010', 'Kleparz Corner',        'ul. Długa 30, Kraków',       'b0000000-0000-4000-8000-000000000002', '#3b82f6', '1000010'),
  ('c0000000-0000-4000-8000-000000000011', 'Grzegórzki Terrace',    'ul. Kotlarska 11, Kraków',   'b0000000-0000-4000-8000-000000000002', '#6366f1', '1000011'),
  ('c0000000-0000-4000-8000-000000000012', 'Zakopane Chalet',       'ul. Krupówki 40, Zakopane',  'b0000000-0000-4000-8000-000000000003', '#8b5cf6', '1000012'),
  ('c0000000-0000-4000-8000-000000000013', 'Tatra Mountain Cabin',  'ul. Kościeliska 7, Zakopane','b0000000-0000-4000-8000-000000000003', '#a855f7', '1000013'),
  ('c0000000-0000-4000-8000-000000000014', 'Gubałówka Panorama',    'ul. Gubałówka 3, Zakopane',  'b0000000-0000-4000-8000-000000000003', '#d946ef', '1000014'),
  ('c0000000-0000-4000-8000-000000000015', 'Wieliczka Salt House',  'ul. Daniłowicza 6, Wieliczka','b0000000-0000-4000-8000-000000000003', '#ec4899', '1000015');

-- ---------------------------------------------------------------------------
-- Channels: every property is on Booking.com; every third is also on Airbnb.
-- demo:// URLs are served by the built-in demo feed generator
-- (src/lib/sync/demo-feed.ts) when DEMO_FEEDS=true. No real feeds here.
-- Reservations are not inserted directly: run `npm run sync` after a reset,
-- so they come through the real sync pipeline.
-- ---------------------------------------------------------------------------
with channel_sets as (
  select
    p.id,
    p.booking_property_id,
    case when p.booking_property_id::int % 3 = 0 then 'booking,airbnb' else 'booking' end as channels
  from public.properties p
)
insert into public.channels (property_id, source, ical_url)
select
  cs.id,
  source::public.channel_source,
  'demo://' || cs.booking_property_id || '/' || source || '?channels=' || cs.channels
    -- One feed fails on purpose, so the demo shows how sync errors look.
    || case when cs.booking_property_id = '1000008' and source = 'airbnb' then '&fail=404' else '' end
from channel_sets cs
cross join lateral unnest(string_to_array(cs.channels, ',')) as source;
