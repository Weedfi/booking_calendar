-- Debug info for email-triggered syncs. Email content is never stored:
-- only when the email arrived and how its property was identified.

create type public.property_match as enum ('booking_id', 'name', 'none');

alter table public.sync_events
  add column received_at timestamptz,
  add column matched_by public.property_match;

comment on column public.sync_events.received_at is 'Email trigger only: when the notification email arrived.';
comment on column public.sync_events.matched_by is 'Email trigger only: how the property was identified (none = synced all).';

-- Debounce lookups: latest email-triggered sync per property.
create index sync_events_trigger_property_started_idx
  on public.sync_events (trigger, property_id, started_at desc);
