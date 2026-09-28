import type { ChannelSource } from "@/lib/calendar/tape-chart";
import type { DateKey } from "@/lib/dates";
import { normalize, type ExportRow } from "./booking-export";

export type ImportableProperty = {
  id: string;
  name: string;
  bookingRoomName: string | null;
  /** The property's channels; imported stays are attached to its Booking.com one. */
  channels: { id: string; source: ChannelSource }[];
};

export type ImportRecord = {
  property_id: string;
  channel_id: string;
  source: ChannelSource;
  external_uid: string;
  start_date: DateKey;
  end_date: DateKey;
  summary: string;
  status: "active";
};

/** A guest name for a stay (apartment + dates), from the file. */
export type ImportGuest = { property_id: string; start_date: DateKey; end_date: DateKey; guest_name: string };

export type ImportPlan = {
  records: ImportRecord[];
  /** Names for every non-cancelled stay in the file, past or future. */
  guests: ImportGuest[];
  skipped: { cancelled: number; notFinished: number; unknownRooms: string[]; noChannel: string[] };
};

/**
 * Turns export rows into reservation rows and guest names. Guest names are
 * taken for every non-cancelled stay; reservations only for finished stays:
 * current and future ones come from the iCal feed, and importing them here
 * would duplicate them (the sync would also cancel them, as they are not in
 * the feed). The external UID is derived from the reservation number, so
 * importing the same file twice changes nothing.
 */
export function planImport(rows: ExportRow[], properties: ImportableProperty[], today: DateKey): ImportPlan {
  const plan: ImportPlan = { records: [], guests: [], skipped: { cancelled: 0, notFinished: 0, unknownRooms: [], noChannel: [] } };
  const seen = new Set<string>();
  const seenGuests = new Set<string>();

  for (const row of rows) {
    if (row.cancelled) {
      plan.skipped.cancelled++;
      continue;
    }
    const property = findProperty(row.room, properties);
    if (!property) {
      if (!plan.skipped.unknownRooms.includes(row.room)) plan.skipped.unknownRooms.push(row.room);
      continue;
    }

    // Names are keyed by apartment and dates, so they also attach to future
    // stays that arrive through the iCal feed.
    const guestKey = `${property.id}|${row.checkIn}|${row.checkOut}`;
    if (row.guestName && !seenGuests.has(guestKey)) {
      seenGuests.add(guestKey);
      plan.guests.push({ property_id: property.id, start_date: row.checkIn, end_date: row.checkOut, guest_name: row.guestName });
    }

    if (row.checkOut > today) {
      plan.skipped.notFinished++;
      continue;
    }
    const channel = property.channels.find((c) => c.source === "booking") ?? property.channels[0];
    if (!channel) {
      if (!plan.skipped.noChannel.includes(property.name)) plan.skipped.noChannel.push(property.name);
      continue;
    }

    const externalUid = `booking-export-${row.number}-${property.id.slice(0, 8)}`;
    if (seen.has(`${channel.id}|${externalUid}`)) continue;
    seen.add(`${channel.id}|${externalUid}`);

    plan.records.push({
      property_id: property.id,
      channel_id: channel.id,
      source: channel.source,
      external_uid: externalUid,
      start_date: row.checkIn,
      end_date: row.checkOut,
      summary: "Import z Booking.com",
      status: "active",
    });
  }
  return plan;
}

/** Exact name match first (room name or apartment name), then a unique containment. */
function findProperty(room: string, properties: ImportableProperty[]): ImportableProperty | null {
  const target = normalize(room);
  const names = (p: ImportableProperty) => [p.bookingRoomName, p.name].filter((n): n is string => Boolean(n)).map(normalize);

  const exact = properties.filter((p) => names(p).includes(target));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const partial = properties.filter((p) => names(p).some((n) => n.length >= 4 && (target.includes(n) || n.includes(target))));
  return partial.length === 1 ? partial[0] : null;
}
