import { isDateKey, type DateKey } from "@/lib/dates";

/**
 * History import from the reservation list you can download in the
 * Booking.com extranet. The iCal feed only covers today onwards, so this is
 * the only way to see stays from before the first sync.
 *
 * Only room, dates, status and reservation number are read. Guest names,
 * prices and contact details in the file are ignored and never stored.
 */

export type ExportRow = {
  number: string;
  room: string;
  checkIn: DateKey;
  checkOut: DateKey;
  cancelled: boolean;
};

export type ParseResult = { ok: true; rows: ExportRow[]; invalid: number } | { ok: false; error: string };

/** Header aliases, normalized (lowercase, no diacritics). First match wins. */
const COLUMNS = {
  number: ["numer rezerwacji", "nr rezerwacji", "book number", "booking number", "reservation number"],
  checkIn: ["zameldowanie", "data przyjazdu", "przyjazd", "check in", "arrival"],
  checkOut: ["wymeldowanie", "data wyjazdu", "wyjazd", "check out", "departure"],
  status: ["status"],
  // "Unit type" names the room; "Rooms" in some exports is only a count.
  room: ["typ jednostki", "rodzaj jednostki", "typ pokoju", "rodzaj pokoju", "unit type", "room type", "pokoj", "pokoje", "rooms", "room"],
} as const;

type Column = keyof typeof COLUMNS;

export function parseBookingExport(raw: string): ParseResult {
  const text = raw.replace(/^﻿/, "");
  const table = text.trimStart().startsWith("<") ? parseHtmlTable(text) : parseDelimited(text);
  if (table.length < 2) return { ok: false, error: "Plik jest pusty albo nie zawiera tabeli rezerwacji." };

  const headerIndex = table.findIndex((row) => findColumns(row) !== null);
  if (headerIndex === -1) {
    return {
      ok: false,
      error: "Nie znaleziono kolumn z numerem rezerwacji, zameldowaniem, wymeldowaniem i pokojem. Czy to lista rezerwacji z Booking.com?",
    };
  }
  const columns = findColumns(table[headerIndex])!;

  const rows: ExportRow[] = [];
  let invalid = 0;
  for (const cells of table.slice(headerIndex + 1)) {
    if (cells.every((c) => !c.trim())) continue;
    const get = (column: Column) => (columns[column] === undefined ? "" : (cells[columns[column]!] ?? "").trim());
    const checkIn = parseDate(get("checkIn"));
    const checkOut = parseDate(get("checkOut"));
    const number = get("number").replace(/\s+/g, "");
    const room = get("room");
    if (!checkIn || !checkOut || checkOut <= checkIn || !number || !room) {
      invalid++;
      continue;
    }
    rows.push({ number, room, checkIn, checkOut, cancelled: /cancel|anul|odwo/i.test(get("status")) });
  }
  return { ok: true, rows, invalid };
}

function findColumns(header: string[]): Partial<Record<Column, number>> | null {
  const normalized = header.map(normalize);
  const found: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(COLUMNS) as Column[]) {
    for (const alias of COLUMNS[column]) {
      const index = normalized.indexOf(alias);
      if (index !== -1) {
        found[column] = index;
        break;
      }
    }
  }
  const required: Column[] = ["number", "checkIn", "checkOut", "room"];
  return required.every((c) => found[c] !== undefined) ? found : null;
}

// ---------------------------------------------------------------------------
// Table formats
// ---------------------------------------------------------------------------

/** CSV or TSV with quotes; the delimiter is guessed from the first line. */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

/** "Excel" downloads that are really HTML tables. */
function parseHtmlTable(html: string): string[][] {
  const decode = (s: string) =>
    s
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .trim();
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((tr) =>
    [...tr[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((td) => decode(td[1])),
  );
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  sty: 1, lut: 2, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paz: 10, lis: 11, gru: 12,
};

/** Accepts 2026-09-19, 19.09.2026, 19/09/2026, 19 Sep 2026, Sep 19, 2026, 19 wrz 2026. */
export function parseDate(value: string): DateKey | null {
  // Drop a time part, lowercase, strip diacritics and commas; keep - / . for numeric dates.
  const v = value
    .split(/[ T]\d{1,2}:\d{2}/)[0]
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  const build = (y: number, m: number, d: number) => {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    return isDateKey(key) ? key : null;
  };

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v);
  if (m) return build(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/.exec(v);
  if (m && MONTHS[m[2]]) return build(+m[3], MONTHS[m[2]], +m[1]);
  m = /^([a-z]{3})[a-z]* (\d{1,2}) (\d{4})$/.exec(v);
  if (m && MONTHS[m[1]]) return build(+m[3], MONTHS[m[1]], +m[2]);
  return null;
}

/** Lowercase, no diacritics, punctuation to single spaces. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}./-]+/gu, " ")
    .replace(/\s*-\s*/g, " ")
    .trim();
}
