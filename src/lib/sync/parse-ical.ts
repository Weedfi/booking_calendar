import ical from "node-ical";
import { addDays, dateKeyInZone, type DateKey } from "./dates";

/** One occupied range from a feed. endDate is the checkout day (exclusive). */
export type FeedEvent = {
  uid: string;
  startDate: DateKey;
  endDate: DateKey;
  summary: string | null;
};

export type ParsedFeed = {
  events: FeedEvent[];
  /** VEVENTs that were ignored (no UID or start, or STATUS:CANCELLED). */
  skipped: number;
};

export class InvalidFeedError extends Error {
  constructor(message = "Response is not an iCalendar feed") {
    super(message);
    this.name = "InvalidFeedError";
  }
}

type IcalDate = Date & { dateOnly?: boolean; tz?: string };

/**
 * Parses an .ics document into occupied date ranges.
 *
 * Booking.com and Airbnb export all-day events (VALUE=DATE), where DTEND is
 * the checkout day and already exclusive, so it maps 1:1 onto end_date.
 * Recurrence rules are ignored: channel feeds list each stay as its own event.
 */
export function parseIcal(text: string): ParsedFeed {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new InvalidFeedError();

  const byUid = new Map<string, FeedEvent>();
  let skipped = 0;

  for (const component of Object.values(ical.parseICS(text))) {
    if (!component || component.type !== "VEVENT") continue;

    const uid = typeof component.uid === "string" ? component.uid.trim() : "";
    const start = component.start as IcalDate | undefined;
    if (!uid || !start || Number.isNaN(start.getTime()) || component.status === "CANCELLED") {
      skipped++;
      continue;
    }

    // node-ical already keys events by UID (the last duplicate wins); this
    // guards against UIDs that only differ by surrounding whitespace.
    if (byUid.has(uid)) continue;

    const startDate = toDateKey(start);
    const end = component.end as IcalDate | undefined;
    let endDate = end && !Number.isNaN(end.getTime()) ? toDateKey(end) : addDays(startDate, 1);
    // Zero-length or inverted ranges still block at least one night.
    if (endDate <= startDate) endDate = addDays(startDate, 1);

    byUid.set(uid, { uid, startDate, endDate, summary: textValue(component.summary) });
  }

  return { events: [...byUid.values()], skipped };
}

function toDateKey(value: IcalDate): DateKey {
  // DATE values are built from local date parts, so read them back the same way.
  if (value.dateOnly || !value.tz) return localDateKey(value);
  try {
    return dateKeyInZone(value, value.tz);
  } catch {
    // Unknown TZID (e.g. a Windows zone name): fall back to UTC.
    return value.toISOString().slice(0, 10);
  }
}

function localDateKey(value: Date): DateKey {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function textValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object" && "val" in value && typeof value.val === "string") {
    return value.val.trim() || null;
  }
  return null;
}
