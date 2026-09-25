import { APP_TIMEZONE, dateKeyInZone, type DateKey } from "@/lib/dates";
import { fetchIcal as defaultFetchIcal, type FetchIcal } from "./fetch-ical";
import { parseIcal } from "./parse-ical";
import { planChannelSync } from "./plan";
import type { SyncChannel, SyncStore, SyncTrigger } from "./store";

export type ChannelSyncResult =
  | { channelId: string; ok: true; upserted: number; cancelled: number }
  | { channelId: string; ok: false; error: string };

export type SyncRunResult = {
  ok: boolean;
  channels: ChannelSyncResult[];
};

type Deps = {
  store: SyncStore;
  fetchIcal?: FetchIcal;
  now?: () => Date;
  timeZone?: string;
};

/** Syncs one channel: fetch, parse, diff, write. Throws on any failure. */
export async function syncChannel(
  channel: SyncChannel,
  { store, fetchIcal = defaultFetchIcal, today }: { store: SyncStore; fetchIcal?: FetchIcal; today: DateKey },
): Promise<{ upserted: number; cancelled: number }> {
  const feed = parseIcal(await fetchIcal(channel.icalUrl));
  const stored = await store.listReservations(channel.id);
  const plan = planChannelSync(stored, feed.events, today);

  if (plan.upserts.length > 0) await store.upsertReservations(channel, plan.upserts);
  if (plan.cancelUids.length > 0) await store.cancelReservations(channel.id, plan.cancelUids);

  return { upserted: plan.upserts.length, cancelled: plan.cancelUids.length };
}

/**
 * Syncs every channel (or only those of the given properties) and logs the
 * run in sync_events. One failing channel never stops the others.
 */
export async function runSync(
  options: { trigger: SyncTrigger; propertyIds?: string[] },
  { store, fetchIcal, now = () => new Date(), timeZone = APP_TIMEZONE }: Deps,
): Promise<SyncRunResult> {
  const startedAt = now();
  const today = dateKeyInZone(startedAt, timeZone);
  const propertyId = options.propertyIds?.length === 1 ? options.propertyIds[0] : null;
  const eventId = await store.startSyncEvent({ trigger: options.trigger, propertyId, startedAt });

  const channels = await store.listChannels({ propertyIds: options.propertyIds });

  // Channels are independent, so fetch them in parallel.
  const results = await Promise.all(
    channels.map(async (channel): Promise<ChannelSyncResult> => {
      try {
        const counts = await syncChannel(channel, { store, fetchIcal, today });
        await store.recordChannelResult(channel.id, { syncedAt: now(), error: null });
        return { channelId: channel.id, ok: true, ...counts };
      } catch (error) {
        const message = errorMessage(error);
        await store
          .recordChannelResult(channel.id, { syncedAt: now(), error: message })
          .catch(() => {});
        return { channelId: channel.id, ok: false, error: message };
      }
    }),
  );

  const failures = results.filter((r) => !r.ok);
  const ok = failures.length === 0;
  await store.finishSyncEvent(eventId, {
    finishedAt: now(),
    ok,
    error: ok ? null : summarizeFailures(failures, results.length),
  });

  return { ok, channels: results };
}

function summarizeFailures(
  failures: Extract<ChannelSyncResult, { ok: false }>[],
  total: number,
): string {
  const distinct = [...new Set(failures.map((f) => f.error))].join("; ");
  return `${failures.length} of ${total} channels failed: ${distinct}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  // Supabase/PostgREST errors are plain objects with a message field.
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Unknown error";
}
