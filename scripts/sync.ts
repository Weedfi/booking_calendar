/**
 * Runs one full sync from the command line: `npm run sync`.
 * Used after `npm run db:reset` to import the demo feeds, and handy for
 * debugging. Reads .env.local; needs SUPABASE_SECRET_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { runSync } from "@/lib/sync/run-sync";
import { createSupabaseSyncStore } from "@/lib/sync/supabase-store";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const result = await runSync({ trigger: "manual" }, { store: createSupabaseSyncStore(db) });

  for (const channel of result.channels) {
    console.log(
      channel.ok
        ? `ok      ${channel.channelId}  +${channel.upserted} upserted, ${channel.cancelled} cancelled`
        : `FAILED  ${channel.channelId}  ${channel.error}`,
    );
  }
  console.log(result.ok ? "All channels synced." : "Some channels failed (see above).");
  if (!result.ok) process.exitCode = 1;
}

main();
