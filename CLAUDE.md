@AGENTS.md

# Rental Calendar Portal

## Goal
Web app for a short-term rental manager who runs ~15 apartments for different owners.
- **Admin** (the manager) sees ALL properties' booking calendars, near real-time, with filters.
- **Owner** logs in and sees ONLY their own properties: when they are booked, upcoming stays, occupancy.
- Read-only view of bookings. The app never writes anything back to Booking.com.
- Must be free to run (free tiers only). Also a portfolio/CV project, so code quality, README and tests matter.

## Data source
- Each property on Booking.com has an **iCal export URL** (.ics). Later, Airbnb iCal URLs may be added (a property can have multiple channels).
- iCal gives only: UID, DTSTART, DTEND (checkout day, exclusive), SUMMARY (e.g. "CLOSED - Not available"). No guest names, no prices.
- Bookings and manual blocks look the same in the feed. Treat both as "occupied".
- Booking.com merges consecutive unavailable days into one event; a property closed for sale shows up as one block to the end of the feed. Blocks of more than 30 nights are displayed as "closed", not as stays (src/lib/calendar/closures.ts).
- The feed only covers today onwards and has no guest names. The extranet reservation export can be imported: finished stays become reservations, and guest names are stored for every non-cancelled stay (past or future). Prices and contact details from the file are not stored. Guest name priority: manual > import > email.
- iCal URLs are secrets. Never send them to the client, never expose them to owners.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Supabase: Postgres, Auth (magic link email login, plus an optional password each user sets for themselves on /account; signups disabled, invite-only), Row Level Security, Realtime
- Hosting: Vercel (free tier)
- iCal parsing: `node-ical`
- Tests: Vitest; CI: GitHub Actions

## Data model
- `profiles` (id = auth.users.id, full_name, role: 'admin' | 'owner')
- `properties` (id, name, address, owner_id -> profiles.id, color)
- `channels` (id, property_id, source: 'booking' | 'airbnb' | 'other', ical_url, last_synced_at, last_sync_error)
- `reservations` (id, property_id, channel_id, source, external_uid, start_date, end_date, summary, status: 'active' | 'cancelled', created_at, updated_at)
  - unique (channel_id, external_uid)

## Security (RLS is the source of truth, not the UI)
- Admin: full access to everything.
- Owner: SELECT on `properties` where owner_id = auth.uid(); SELECT on `reservations` joined through their properties.
- Owners have NO access to `channels` (hides iCal URLs).
- Guest names (`guest_stays`): admin reads and writes; owners read the names for their own properties only. Product decision (2026-09-28): owners may see guest names; names are kept until the admin deletes them (no automatic deletion).
- Write a test proving an owner cannot read another owner's data.

## Sync logic
1. For each channel: fetch .ics, parse VEVENTs.
2. Upsert by (channel_id, external_uid).
3. UIDs present in DB but missing from the feed (future dates only) -> status 'cancelled'.
4. Update `last_synced_at` / `last_sync_error`.
5. Sync must be idempotent and must not fail the whole run if one channel fails.

Triggers:
- **Cron** every 1-5 min (Vercel Cron or GitHub Actions) as a fallback.
- **Email trigger** (core feature, see section below).
- **Manual** "Refresh now" button for admin.
- Protect webhook and cron endpoints with a secret.

## Email trigger (near real-time sync)
Booking.com emails the manager on every new, modified and cancelled booking. We use these emails to sync within seconds instead of waiting for cron.

Flow:
1. Manager's mailbox auto-forwards Booking.com notification emails to a dedicated address (e.g. `sync@<domain>` via **Cloudflare Email Routing** -> Cloudflare Email Worker). Alternative: Gmail API watch + Pub/Sub push.
2. The Worker POSTs a minimal payload (subject, sender, received_at, plain-text body) to `/api/sync-trigger` with a shared secret header.
3. The endpoint:
   - verifies the secret and that the sender is a Booking.com address,
   - extracts the property identifier (Booking property ID and/or property name) from the subject/body,
   - maps it to a property via a `booking_property_id` column on `properties` (add it to the schema),
   - immediately syncs that property's channels.
4. If the property can't be identified -> sync ALL channels (15 properties is cheap).
5. Supabase Realtime pushes the change to the admin UI (toast + live tape chart update).

Rules:
- The email triggers a sync; the iCal feed stays the single source of truth for dates. The only data kept from an email is the guest's name for the stay (`guest_stays`, source 'email'), and a name entered by hand is never overwritten.
- Debounce: if the same property was synced in the last ~20 s, skip or queue one follow-up sync (Booking may send several emails at once).
- Booking may update the iCal feed with a delay: after an email trigger, re-sync that property once more after ~2 min.
- Don't store email bodies. Log only: received_at, matched property, sync result.
- Parsing must be resilient: if Booking changes the email format, we fall back to "sync all" and cron still works.
- Table `sync_events` (id, trigger: 'email' | 'cron' | 'manual', property_id nullable, started_at, finished_at, ok, error) for debugging and for the admin "last synced" indicator.
- Tests: property extraction from sample subjects (fake fixtures), secret check, debounce, fallback to sync-all.

## Admin UI
- **Tape chart**: rows = properties, columns = days, reservations as bars from check-in to check-out; scroll by week/month; color by channel.
- **Today & tomorrow** panel: check-outs and check-ins (cleaning plan).
- Filters: owner, property, channel, date range.
- Monthly occupancy % per property.
- Per-property "last synced X min ago" indicator + sync errors.
- Manage properties, channels (paste iCal URL), invite owners by email.
- Live updates via Supabase Realtime + toast "New booking: <property>, <dates>".
- Mobile: list of upcoming check-ins/outs instead of the tape chart.

## Owner UI
- Magic link login or own password.
- List of own properties, calendar with occupied dates, upcoming stays, monthly occupancy %.
- Mobile-first (owners will mostly use phones).

## Milestones
1. Project setup, Supabase schema + RLS + seed data (fake properties/owners/bookings).
2. iCal sync service + tests (parsing, upsert, cancellation, DTEND exclusive).
3. Admin tape chart + filters.
4. Owner view.
5. Cron + manual refresh + last-synced indicators.
6. Email trigger webhook.
7. Realtime updates.
8. README (architecture diagram, screenshots), CI, public demo on fake data.

## Rules
- Never commit real iCal URLs, real guest data or secrets. Use `.env.local` and `.env.example`.
- Public demo uses seed data only.
- Keep code, comments and commits in English.
- Prefer small, reviewable steps; run tests before finishing a task.
