import type { DateKey } from "@/lib/dates";
import { parseDate } from "@/lib/parse-date";

export type EmailGuest = { guestName: string; checkIn: DateKey; checkOut: DateKey };

/** Labels Booking.com puts before the guest's name, most specific first. */
const NAME_LABELS = [
  "imię i nazwisko gościa",
  "imie i nazwisko goscia",
  "nazwisko gościa",
  "gość",
  "gosc",
  "guest name",
  "guest",
  "zarezerwowane przez",
  "booked by",
  "booker",
];
const CHECK_IN_LABELS = ["zameldowanie", "data przyjazdu", "przyjazd", "check-in", "check in", "arrival"];
const CHECK_OUT_LABELS = ["wymeldowanie", "data wyjazdu", "wyjazd", "check-out", "check out", "departure"];

/**
 * Reads the guest's name and stay dates from a Booking.com notification, if
 * all three are there in "Label: value" lines. Anything missing or odd gives
 * null: the sync itself never depends on this.
 */
export function extractGuest(subject: string, text: string): EmailGuest | null {
  const lines = `${subject}\n${text}`.split(/\r?\n/).map((l) => l.trim());

  const valueAfter = (labels: string[]) => {
    for (const label of labels) {
      for (const line of lines) {
        const m = new RegExp(`^${escape(label)}\\s*[:：-]\\s*(.+)$`, "i").exec(line);
        if (m) return m[1].trim();
      }
    }
    return null;
  };

  const guestName = cleanName(valueAfter(NAME_LABELS));
  const checkIn = parseDate(valueAfter(CHECK_IN_LABELS) ?? "");
  const checkOut = parseDate(valueAfter(CHECK_OUT_LABELS) ?? "");
  if (!guestName || !checkIn || !checkOut || checkOut <= checkIn) return null;
  return { guestName, checkIn, checkOut };
}

function cleanName(value: string | null): string | null {
  if (!value) return null;
  const name = value.replace(/\s+/g, " ").replace(/[<>]/g, "").trim();
  // A name has letters, is not an email address or number, and is of sane length.
  if (name.length < 2 || name.length > 200 || !/\p{Letter}/u.test(name) || /@|\d{4,}/.test(name)) return null;
  return name;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
