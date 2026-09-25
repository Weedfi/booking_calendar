import type { FeedEvent } from "./parse-ical";
import type { StoredReservation } from "./plan";

export type ChannelSource = "booking" | "airbnb" | "other";
export type SyncTrigger = "email" | "cron" | "manual";
export type PropertyMatch = "booking_id" | "name" | "none";

/** Email-trigger details logged with a sync run. Never the email content. */
export type EmailTriggerInfo = { receivedAt: Date; matchedBy: PropertyMatch };

export type SyncChannel = {
  id: string;
  propertyId: string;
  source: ChannelSource;
  icalUrl: string;
};

/**
 * Persistence used by the sync. The Supabase implementation lives in
 * supabase-store.ts; tests use an in-memory one.
 */
export interface SyncStore {
  listChannels(filter?: { propertyIds?: string[] }): Promise<SyncChannel[]>;
  listReservations(channelId: string): Promise<StoredReservation[]>;
  upsertReservations(channel: SyncChannel, events: FeedEvent[]): Promise<void>;
  cancelReservations(channelId: string, externalUids: string[]): Promise<void>;
  /** Success sets last_synced_at and clears the error; failure only sets the error. */
  recordChannelResult(channelId: string, result: { syncedAt: Date; error: string | null }): Promise<void>;
  startSyncEvent(event: {
    trigger: SyncTrigger;
    propertyId: string | null;
    startedAt: Date;
    email?: EmailTriggerInfo;
  }): Promise<number>;
  finishSyncEvent(id: number, result: { finishedAt: Date; ok: boolean; error: string | null }): Promise<void>;
}
