import { isDateKey, type DateKey } from "@/lib/dates";

/** Month names by their first three letters (Polish without diacritics, and English). */
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  sty: 1, lut: 2, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paz: 10, lis: 11, gru: 12,
};

/** Weekday words that may precede a date ("pt., 16 paź 2026", "Friday, 16 October 2026"). */
const WEEKDAYS = new Set([
  "pn", "pon", "poniedzialek", "wt", "wtorek", "sr", "sroda", "cz", "czw", "czwartek", "pt", "pia", "piatek",
  "so", "sob", "sobota", "nd", "nie", "ndz", "niedz", "niedziela",
  "mon", "monday", "tue", "tues", "tuesday", "wed", "wednesday", "thu", "thur", "thurs", "thursday",
  "fri", "friday", "sat", "saturday", "sun", "sunday",
]);

/**
 * Human-written dates from Booking.com exports and emails:
 * 2026-09-19, 19.09.2026, 19/09/2026, 19 Sep 2026, Sep 19, 2026,
 * 19 wrz 2026, 16 października 2026, pt., 16 paź 2026, Friday, 16 October 2026.
 */
export function parseDate(value: string): DateKey | null {
  // Drop a time part, lowercase, strip diacritics and commas; keep - / . for numeric dates.
  let v = value
    .split(/[ T]\d{1,2}:\d{2}/)[0]
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // A leading weekday ("pt.", "friday") is noise, but only if it really is one.
  const first = /^([a-z]+)\.?\s+(.*)$/.exec(v);
  if (first && WEEKDAYS.has(first[1])) v = first[2];

  const pad = (n: number) => String(n).padStart(2, "0");
  const build = (y: number, m: number, d: number) => {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    return isDateKey(key) ? key : null;
  };

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v);
  if (m) return build(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\.? ([a-z]{3})[a-z]*\.? (\d{4})$/.exec(v);
  if (m && MONTHS[m[2]]) return build(+m[3], MONTHS[m[2]], +m[1]);
  m = /^([a-z]{3})[a-z]*\.? (\d{1,2}) (\d{4})$/.exec(v);
  if (m && MONTHS[m[1]]) return build(+m[3], MONTHS[m[1]], +m[2]);
  return null;
}
