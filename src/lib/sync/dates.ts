/**
 * Calendar dates are handled as "YYYY-MM-DD" strings, matching Postgres `date`.
 * This avoids the classic off-by-one bugs of mixing Date objects and timezones.
 */
export type DateKey = string;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): value is DateKey {
  return DATE_KEY.test(value);
}

/** Calendar date of an instant in the given IANA timezone. */
export function dateKeyInZone(instant: Date, timeZone: string): DateKey {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function addDays(key: DateKey, days: number): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
