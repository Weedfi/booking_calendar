import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { SyncStore } from "./store";

/** Keeps `in (...)` filters well under URL length limits. */
const CHUNK_SIZE = 100;

/** SyncStore backed by Supabase. Expects a client with the secret key (bypasses RLS). */
export function createSupabaseSyncStore(db: SupabaseClient<Database>): SyncStore {
  return {
    async listChannels(filter) {
      let query = db.from("channels").select("id, property_id, source, ical_url");
      if (filter?.propertyIds) query = query.in("property_id", filter.propertyIds);
      const { data, error } = await query;
      if (error) throw error;
      return data.map((c) => ({
        id: c.id,
        propertyId: c.property_id,
        source: c.source,
        icalUrl: c.ical_url,
      }));
    },

    async listReservations(channelId) {
      const { data, error } = await db
        .from("reservations")
        .select("external_uid, start_date, end_date, summary, status")
        .eq("channel_id", channelId);
      if (error) throw error;
      return data.map((r) => ({
        externalUid: r.external_uid,
        startDate: r.start_date,
        endDate: r.end_date,
        summary: r.summary,
        status: r.status,
      }));
    },

    async upsertReservations(channel, events) {
      const rows = events.map((e) => ({
        property_id: channel.propertyId,
        channel_id: channel.id,
        source: channel.source,
        external_uid: e.uid,
        start_date: e.startDate,
        end_date: e.endDate,
        summary: e.summary,
        status: "active" as const,
      }));
      const { error } = await db
        .from("reservations")
        .upsert(rows, { onConflict: "channel_id,external_uid" });
      if (error) throw error;
    },

    async cancelReservations(channelId, externalUids) {
      for (let i = 0; i < externalUids.length; i += CHUNK_SIZE) {
        const { error } = await db
          .from("reservations")
          .update({ status: "cancelled" })
          .eq("channel_id", channelId)
          .in("external_uid", externalUids.slice(i, i + CHUNK_SIZE));
        if (error) throw error;
      }
    },

    async recordChannelResult(channelId, { syncedAt, error: syncError }) {
      const { error } = await db
        .from("channels")
        .update(
          syncError === null
            ? { last_synced_at: syncedAt.toISOString(), last_sync_error: null }
            : { last_sync_error: syncError },
        )
        .eq("id", channelId);
      if (error) throw error;
    },

    async startSyncEvent({ trigger, propertyId, startedAt }) {
      const { data, error } = await db
        .from("sync_events")
        .insert({ trigger, property_id: propertyId, started_at: startedAt.toISOString() })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },

    async finishSyncEvent(id, { finishedAt, ok, error: syncError }) {
      const { error } = await db
        .from("sync_events")
        .update({ finished_at: finishedAt.toISOString(), ok, error: syncError })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
