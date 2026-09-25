import type { PropertyMatch } from "@/lib/sync/store";

export type MatchableProperty = {
  id: string;
  name: string;
  bookingPropertyId: string | null;
};

export type PropertyMatchResult = {
  /** null means "could not tell which one": sync every property. */
  propertyId: string | null;
  matchedBy: PropertyMatch;
};

/**
 * Finds which property a Booking.com notification is about.
 *
 * 1. A number in the email equal to a known Booking.com property ID.
 * 2. Otherwise a known property name (case and diacritics ignored).
 * Anything ambiguous or unknown falls back to syncing everything, so a change
 * in Booking's email format can only make the sync broader, never skip it.
 */
export function matchProperty(subject: string, text: string, properties: MatchableProperty[]): PropertyMatchResult {
  const content = `${subject}\n${text}`;

  const numbers = new Set(content.match(/\d{5,12}/g) ?? []);
  const byId = properties.filter((p) => p.bookingPropertyId && numbers.has(p.bookingPropertyId));
  if (byId.length === 1) return { propertyId: byId[0].id, matchedBy: "booking_id" };
  if (byId.length > 1) return { propertyId: null, matchedBy: "none" };

  const haystack = ` ${normalize(content)} `;
  const byName = properties.filter((p) => {
    const name = normalize(p.name);
    return name.length >= 4 && haystack.includes(` ${name} `);
  });
  // "Old Town Loft" also contains "Town Loft": keep only the most specific names.
  const specific = byName.filter(
    (p) => !byName.some((q) => q !== p && normalize(q.name).includes(normalize(p.name))),
  );
  if (specific.length === 1) return { propertyId: specific[0].id, matchedBy: "name" };

  return { propertyId: null, matchedBy: "none" };
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
