import type { StoredReservation } from "@/lib/sync/plan";
import type { SyncChannel, SyncStore, SyncTrigger } from "@/lib/sync/store";

type Row = StoredReservation & { channelId: string; propertyId: string; writes: number };

/** In-memory SyncStore for unit tests. Counts writes to prove idempotence. */
export function createMemoryStore(channels: SyncChannel[]) {
  const reservations = new Map<string, Row>();
  const channelState = new Map<string, { lastSyncedAt: Date | null; lastSyncError: string | null }>(
    channels.map((c) => [c.id, { lastSyncedAt: null, lastSyncError: null }]),
  );
  const syncEvents: {
    id: number;
    trigger: SyncTrigger;
    propertyId: string | null;
    ok: boolean | null;
    error: string | null;
  }[] = [];
  let writes = 0;

  const key = (channelId: string, uid: string) => `${channelId}|${uid}`;

  const store: SyncStore = {
    async listChannels(filter) {
      return channels.filter((c) => !filter?.propertyIds || filter.propertyIds.includes(c.propertyId));
    },
    async listReservations(channelId) {
      return [...reservations.values()]
        .filter((r) => r.channelId === channelId)
        .map(({ externalUid, startDate, endDate, summary, status }) => ({
          externalUid,
          startDate,
          endDate,
          summary,
          status,
        }));
    },
    async upsertReservations(channel, events) {
      for (const e of events) {
        writes++;
        const k = key(channel.id, e.uid);
        reservations.set(k, {
          channelId: channel.id,
          propertyId: channel.propertyId,
          externalUid: e.uid,
          startDate: e.startDate,
          endDate: e.endDate,
          summary: e.summary,
          status: "active",
          writes: (reservations.get(k)?.writes ?? 0) + 1,
        });
      }
    },
    async cancelReservations(channelId, uids) {
      for (const uid of uids) {
        const row = reservations.get(key(channelId, uid));
        if (row) {
          writes++;
          row.status = "cancelled";
          row.writes++;
        }
      }
    },
    async recordChannelResult(channelId, { syncedAt, error }) {
      const state = channelState.get(channelId)!;
      if (error === null) {
        state.lastSyncedAt = syncedAt;
        state.lastSyncError = null;
      } else {
        state.lastSyncError = error;
      }
    },
    async startSyncEvent({ trigger, propertyId }) {
      const id = syncEvents.length + 1;
      syncEvents.push({ id, trigger, propertyId, ok: null, error: null });
      return id;
    },
    async finishSyncEvent(id, { ok, error }) {
      Object.assign(syncEvents[id - 1], { ok, error });
    },
  };

  return {
    store,
    reservations: (channelId: string) =>
      [...reservations.values()].filter((r) => r.channelId === channelId),
    channelState: (channelId: string) => channelState.get(channelId)!,
    syncEvents,
    writeCount: () => writes,
  };
}
