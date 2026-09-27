-- One Booking.com property ("obiekt") often holds several apartments as
-- separate room types, each with its own iCal export. An app property is one
-- apartment, so several of them can share the same Booking.com property ID.

alter table public.properties
  drop constraint properties_booking_property_id_key;

create index properties_booking_property_id_idx
  on public.properties (booking_property_id)
  where booking_property_id is not null;

-- The room type's name as Booking.com writes it in notification emails.
-- Optional: the property name is used when it is empty.
alter table public.properties
  add column booking_room_name text
    check (booking_room_name is null or length(booking_room_name) between 1 and 100);

comment on column public.properties.booking_property_id is 'Booking.com property ID; shared by apartments of one Booking.com property.';
comment on column public.properties.booking_room_name is 'Room type name in Booking.com, used to tell apartments of one property apart in emails.';
