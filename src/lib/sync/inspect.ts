import type { DateKey } from "@/lib/dates";
import type { FeedEvent } from "./parse-ical";

export type InspectRow = {
  startDate: DateKey;
  endDate: DateKey;
  summary: string | null;
  /** In the feed now, in the app, or both. */
  inFeed: boolean;
  inApp: boolean;
};

type Stored = { externalUid: string; startDate: DateKey; endDate: DateKey; summary: string | null };

/**
 * Lines up what a channel's feed says right now with what the app holds, from
 * today on. Used by the admin's "Sprawdź feed" to tell a Booking.com export
 * that lacks a block apart from a sync that missed it.
 */
export function compareFeed(feed: FeedEvent[], stored: Stored[], today: DateKey): InspectRow[] {
  const storedByUid = new Map(stored.map((r) => [r.externalUid, r]));
  const feedUids = new Set(feed.map((e) => e.uid));
  const rows: InspectRow[] = [];

  for (const e of feed) {
    if (e.endDate <= today) continue;
    const s = storedByUid.get(e.uid);
    const same = s !== undefined && s.startDate === e.startDate && s.endDate === e.endDate;
    rows.push({ startDate: e.startDate, endDate: e.endDate, summary: e.summary, inFeed: true, inApp: same });
  }
  for (const s of stored) {
    if (s.endDate <= today) continue;
    const e = feedUids.has(s.externalUid) ? feed.find((f) => f.uid === s.externalUid) : undefined;
    // Dates the app still shows but the feed no longer has (or has moved).
    if (!e || e.startDate !== s.startDate || e.endDate !== s.endDate) {
      rows.push({ startDate: s.startDate, endDate: s.endDate, summary: s.summary, inFeed: false, inApp: true });
    }
  }
  return rows.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
}
