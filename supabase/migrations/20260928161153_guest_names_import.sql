-- Guest names can also come from the Booking.com reservation export.
-- Priority when several sources know a stay: manual > import > email.
alter type public.guest_name_source add value if not exists 'import';
