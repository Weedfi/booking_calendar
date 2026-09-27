import { plural } from "@/lib/i18n";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatRelative } from "@/lib/calendar/stats";

export type SyncRun = {
  trigger: "email" | "cron" | "manual";
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  error: string | null;
};

export type SyncStatus = {
  tone: "ok" | "warning" | "error" | "unknown";
  text: string;
  detail: string | null;
};

/** Cron runs every 5 minutes; after 15 without any sync something is wrong. */
const STALE_AFTER_MS = 15 * 60_000;

/** One line for the admin: when the last sync ran, how, and whether it worked. */
export function describeSyncStatus(last: SyncRun | null, failingChannels: number, now: Date): SyncStatus {
  if (!last) return { tone: "unknown", text: "Synchronizacja jeszcze się nie odbyła", detail: null };

  const when = formatRelative(new Date(last.startedAt), now);
  const via = { email: "mail z Booking.com", cron: "harmonogram", manual: "ręczne odświeżenie" }[last.trigger];
  const text = `Ostatnia synchronizacja ${when} (${via})`;

  if (last.finishedAt === null) return { tone: "unknown", text: `Trwa synchronizacja (start ${when})`, detail: null };
  if (now.getTime() - new Date(last.startedAt).getTime() > STALE_AFTER_MS) {
    return { tone: "error", text, detail: "Brak synchronizacji od ponad 15 minut. Sprawdź harmonogram." };
  }
  if (failingChannels > 0) {
    return {
      tone: "warning",
      text,
      detail: `${failingChannels} ${plural(failingChannels, ["kanał ma", "kanały mają", "kanałów ma"])} błąd (czerwone oznaczenia poniżej).`,
    };
  }
  return { tone: "ok", text, detail: null };
}

export async function loadSyncStatus(supabase: SupabaseClient<Database>, now: Date): Promise<SyncStatus> {
  const [last, failing] = await Promise.all([
    supabase
      .from("sync_events")
      .select("trigger, started_at, finished_at, ok, error")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("channels").select("id", { count: "exact", head: true }).not("last_sync_error", "is", null),
  ]);
  if (last.error) throw last.error;
  if (failing.error) throw failing.error;

  const run = last.data && {
    trigger: last.data.trigger,
    startedAt: last.data.started_at,
    finishedAt: last.data.finished_at,
    ok: last.data.ok,
    error: last.data.error,
  };
  return describeSyncStatus(run, failing.count ?? 0, now);
}
