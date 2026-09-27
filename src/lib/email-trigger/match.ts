import type { PropertyMatch } from "@/lib/sync/store";

export type MatchableProperty = {
  id: string;
  name: string;
  bookingPropertyId: string | null;
  /** Room type name in Booking.com, when it differs from `name`. */
  bookingRoomName?: string | null;
};

export type PropertyMatchResult = {
  /** null means "could not tell which one": sync every property. */
  propertyId: string | null;
  matchedBy: PropertyMatch;
};

/**
 * Finds which apartment a Booking.com notification is about.
 *
 * 1. A number in the email equal to a known Booking.com property ID. If only
 *    one apartment has that ID, that's the one.
 * 2. Several apartments can share one Booking.com property (one room type
 *    each). Then, and when no ID matches at all, a room or apartment name in
 *    the email decides (case and diacritics ignored, whole words only).
 * Anything ambiguous or unknown falls back to syncing everything, so a change
 * in Booking's email format can only make the sync broader, never skip it.
 */
export function matchProperty(subject: string, text: string, properties: MatchableProperty[]): PropertyMatchResult {
  const content = `${subject}\n${text}`;

  const numbers = new Set(content.match(/\d{5,12}/g) ?? []);
  const byId = properties.filter((p) => p.bookingPropertyId && numbers.has(p.bookingPropertyId));
  if (byId.length === 1) return { propertyId: byId[0].id, matchedBy: "booking_id" };

  // Several apartments of one Booking.com property: look for the room name
  // among them only. No ID at all: look among every apartment.
  const byName = findByName(content, byId.length > 1 ? byId : properties);
  if (byName) return { propertyId: byName.id, matchedBy: "name" };

  return { propertyId: null, matchedBy: "none" };
}

function findByName(content: string, candidates: MatchableProperty[]): MatchableProperty | null {
  const haystack = ` ${normalize(content)} `;
  const namesOf = (p: MatchableProperty) =>
    [p.bookingRoomName, p.name].filter((n): n is string => Boolean(n)).map(normalize).filter((n) => n.length >= 4);

  const matches = candidates
    .map((p) => ({ property: p, names: namesOf(p).filter((n) => haystack.includes(` ${n} `)) }))
    .filter((m) => m.names.length > 0);

  // "Old Town Loft" also contains "Town Loft": drop a candidate whose matched
  // names all sit inside a longer name matched by another candidate.
  const specific = matches.filter(
    (m) => !matches.some((o) => o !== m && o.names.some((n) => m.names.every((mine) => n !== mine && n.includes(mine)))),
  );
  return specific.length === 1 ? specific[0].property : null;
}

/** Lowercase, no diacritics, words separated by single spaces. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
