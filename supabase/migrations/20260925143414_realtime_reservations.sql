-- Push reservation changes to signed-in browsers (Supabase Realtime).
-- Realtime applies the table's RLS policies to every subscriber, so owners
-- only receive changes for their own properties.
--
-- Replica identity stays default: with RLS enabled, Realtime only sends the
-- primary key of the old row anyway, so clients work from the new row alone.
alter publication supabase_realtime add table public.reservations;
