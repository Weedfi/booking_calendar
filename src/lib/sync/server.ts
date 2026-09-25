import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync, type SyncRunResult } from "./run-sync";
import type { SyncTrigger } from "./store";
import { createSupabaseSyncStore } from "./supabase-store";

/** Runs a sync against the real database with the secret key. Server only. */
export function syncNow(trigger: SyncTrigger, propertyIds?: string[]): Promise<SyncRunResult> {
  return runSync({ trigger, propertyIds }, { store: createSupabaseSyncStore(createAdminClient()) });
}

/** Counts for logs and API responses. Never includes URLs or reservation data. */
export function summarize(result: SyncRunResult) {
  const ok = result.channels.filter((c) => c.ok);
  return {
    ok: result.ok,
    channels: result.channels.length,
    failed: result.channels.length - ok.length,
    upserted: ok.reduce((n, c) => n + c.upserted, 0),
    cancelled: ok.reduce((n, c) => n + c.cancelled, 0),
  };
}
