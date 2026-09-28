import { addDays, daysBetween, type DateKey } from "@/lib/dates";

type Stay = { startDate: DateKey; endDate: DateKey };

/**
 * Booking.com exports bookings and closed dates the same way
 * ("CLOSED - Not available"). A property closed for sale shows up as one
 * block running to the end of the feed (about 18 months). Blocks of more
 * than 30 nights are treated as "blocked", not as a stay: they are drawn
 * differently and never count as occupancy, check-ins or upcoming stays.
 * The stored data is unchanged.
 */
export const CLOSURE_MIN_NIGHTS = 31;

/** Diagonal stripes for blocked dates, unlike any channel's solid colour. */
export const BLOCKED_PATTERN = "repeating-linear-gradient(135deg, #94a3b8 0 4px, #e2e8f0 4px 8px)";

export function isClosure(stay: Stay): boolean {
  return daysBetween(stay.startDate, stay.endDate) >= CLOSURE_MIN_NIGHTS;
}

export function splitClosures<T extends Stay>(items: T[]): { stays: T[]; closures: T[] } {
  const stays: T[] = [];
  const closures: T[] = [];
  for (const item of items) (isClosure(item) ? closures : stays).push(item);
  return { stays, closures };
}

/**
 * Share of the sellable nights in [start, end) that are booked, from 0 to 1.
 * Nights that are closed and not booked are left out; null when that is all of them.
 */
export function openOccupancy(stays: Stay[], closures: Stay[], start: DateKey, end: DateKey): number | null {
  const { booked, open } = openNights(stays, closures, start, end);
  return open > 0 ? booked / open : null;
}

/**
 * Sellable nights in [start, end) and how many of them are booked. A booked
 * night always counts, even inside a closure: an apartment is often closed on
 * Booking.com precisely because it was sold on another channel.
 */
export function openNights(stays: Stay[], closures: Stay[], start: DateKey, end: DateKey): { booked: number; open: number } {
  const booked = nightsIn(stays, start, end);
  const closedOnly = [...nightsIn(closures, start, end)].filter((night) => !booked.has(night)).length;
  return { booked: booked.size, open: daysBetween(start, end) - closedOnly };
}

/** End (exclusive) of the closure covering `day`, if any. */
export function closedUntil(closures: Stay[], day: DateKey): DateKey | null {
  const covering = closures.filter((c) => c.startDate <= day && day < c.endDate);
  if (covering.length === 0) return null;
  return covering.map((c) => c.endDate).sort().at(-1)!;
}

function nightsIn(stays: Stay[], start: DateKey, end: DateKey): Set<DateKey> {
  const nights = new Set<DateKey>();
  for (const stay of stays) {
    const last = stay.endDate < end ? stay.endDate : end;
    for (let night = stay.startDate > start ? stay.startDate : start; night < last; night = addDays(night, 1)) {
      nights.add(night);
    }
  }
  return nights;
}
