/**
 * Calendar dates are handled as "YYYY-MM-DD" strings, matching Postgres `date`.
 * This avoids the classic off-by-one bugs of mixing Date objects and timezones.
 */
export type DateKey = string;

/** Timezone that defines "today" (where the apartments are). */
export const APP_TIMEZONE = "Europe/Warsaw";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): value is DateKey {
  if (!DATE_KEY.test(value)) return false;
  // Rejects impossible dates such as 2031-02-30.
  return toUtcDate(value).toISOString().slice(0, 10) === value;
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

export function todayKey(now = new Date()): DateKey {
  return dateKeyInZone(now, APP_TIMEZONE);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = toUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

export function eachDay(start: DateKey, count: number): DateKey[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** First day of the month and first day of the next month (exclusive end). */
export function monthRange(key: DateKey): { start: DateKey; end: DateKey } {
  const [y, m] = key.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start, end: next };
}

/** Monday of the week containing the date. */
export function startOfWeek(key: DateKey): DateKey {
  const weekday = (toUtcDate(key).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(key, -weekday);
}

export function minDate(...keys: DateKey[]): DateKey {
  return keys.reduce((a, b) => (b < a ? b : a));
}

export function maxDate(...keys: DateKey[]): DateKey {
  return keys.reduce((a, b) => (b > a ? b : a));
}

/** Formats a date key for display, e.g. "Mon 3 Feb". */
export function formatDate(key: DateKey, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...options,
  }).format(toUtcDate(key));
}

function toUtcDate(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
