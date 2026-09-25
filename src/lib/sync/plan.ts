import type { DateKey } from "@/lib/dates";
import type { FeedEvent } from "./parse-ical";

export type ReservationStatus = "active" | "cancelled";

/** What the database already holds for one channel. */
export type StoredReservation = {
  externalUid: string;
  startDate: DateKey;
  endDate: DateKey;
  summary: string | null;
  status: ReservationStatus;
};

export type ChannelSyncPlan = {
  /** New events, changed events, and cancelled ones that came back. */
  upserts: FeedEvent[];
  /** UIDs to mark as cancelled. */
  cancelUids: string[];
};

/**
 * Diffs a channel's feed against the database. Pure, so it is easy to test.
 *
 * - Rows that already match the feed are left alone, so re-running a sync
 *   writes nothing (idempotent, and no noise for Realtime subscribers).
 * - A reservation missing from the feed is cancelled only if it starts today
 *   or later. Feeds drop past stays over time, so history is kept as is.
 */
export function planChannelSync(
  stored: StoredReservation[],
  feed: FeedEvent[],
  today: DateKey,
): ChannelSyncPlan {
  const storedByUid = new Map(stored.map((r) => [r.externalUid, r]));
  const feedUids = new Set(feed.map((e) => e.uid));

  const upserts = feed.filter((event) => {
    const current = storedByUid.get(event.uid);
    return (
      !current ||
      current.status !== "active" ||
      current.startDate !== event.startDate ||
      current.endDate !== event.endDate ||
      current.summary !== event.summary
    );
  });

  const cancelUids = stored
    .filter((r) => r.status === "active" && !feedUids.has(r.externalUid) && r.startDate >= today)
    .map((r) => r.externalUid);

  return { upserts, cancelUids };
}
