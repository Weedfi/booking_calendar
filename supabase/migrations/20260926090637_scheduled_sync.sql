-- Fallback sync every 5 minutes, scheduled inside the database.
-- GitHub Actions schedules can run hours late on quiet repositories, while
-- pg_cron runs on time. The job calls the app's /api/cron/sync endpoint.
--
-- The URL and secret live in Supabase Vault, never in this repository:
--   select vault.create_secret('https://your-app.vercel.app', 'app_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Until both exist the job does nothing, so local databases stay quiet.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.request_scheduled_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  cron_secret text;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'cron_secret';
  if app_url is null or cron_secret is null then
    return;
  end if;

  -- pg_net sends the request asynchronously; the app does the actual sync.
  perform net.http_get(
    url := rtrim(app_url, '/') || '/api/cron/sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || cron_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.request_scheduled_sync() from public, anon, authenticated;

-- cron.schedule with a name replaces an existing job, so this is re-runnable.
select cron.schedule('sync-calendars', '*/5 * * * *', 'select private.request_scheduled_sync()');
