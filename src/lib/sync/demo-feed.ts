import { addDays, todayKey, type DateKey } from "@/lib/dates";

/**
 * Fake iCal feeds for the demo and local development, so the real sync
 * pipeline runs end to end without any real Booking.com or Airbnb account.
 *
 * URL format: demo://<property-key>/<source>?channels=booking,airbnb
 * Stays are generated per property and split across its channels, so two
 * channels of one property never double-book. Generation starts at a fixed
 * epoch, so a stay keeps its dates and UID from one day to the next.
 */

const EPOCH: DateKey = "2026-01-05";
const PAST_DAYS = 60;
const FUTURE_DAYS = 180;

const SUMMARIES: Record<string, string> = {
  booking: "CLOSED - Not available",
  airbnb: "Reserved",
  other: "Blocked",
};

export function isDemoUrl(url: string): boolean {
  return url.startsWith("demo://");
}

export function generateDemoFeed(url: string, today: DateKey = todayKey()): string {
  const { propertyKey, source, channels, fail } = parseDemoUrl(url);
  // `&fail=404` simulates a broken feed, so the demo can show sync errors.
  if (fail) throw new Error(`HTTP ${fail} Not Found`);
  const random = mulberry32(hash(propertyKey));
  const windowStart = addDays(today, -PAST_DAYS);
  const windowEnd = addDays(today, FUTURE_DAYS);

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rental Calendar//Demo feed//EN", "CALSCALE:GREGORIAN"];

  let day = EPOCH;
  for (let n = 1; day < windowEnd; n++) {
    const nights = 1 + Math.floor(random() * 7);
    const channel = channels[Math.floor(random() * channels.length)];
    const gap = Math.floor(random() * random() * 6);
    const end = addDays(day, nights);

    if (channel === source && end > windowStart) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:demo-${propertyKey}-${n}@${source}.demo`,
        `DTSTAMP:${EPOCH.replaceAll("-", "")}T000000Z`,
        `DTSTART;VALUE=DATE:${day.replaceAll("-", "")}`,
        `DTEND;VALUE=DATE:${end.replaceAll("-", "")}`,
        `SUMMARY:${SUMMARIES[source] ?? "Blocked"}`,
        "END:VEVENT",
      );
    }
    day = addDays(end, gap);
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function parseDemoUrl(url: string) {
  const parsed = new URL(url);
  const propertyKey = parsed.host;
  const source = parsed.pathname.replace(/^\//, "");
  const channels = (parsed.searchParams.get("channels") ?? source).split(",").filter(Boolean);
  if (!propertyKey || !source || !channels.includes(source)) {
    throw new Error("Invalid demo feed URL");
  }
  const fail = parsed.searchParams.get("fail");
  return { propertyKey, source, channels, fail: fail && /^\d{3}$/.test(fail) ? fail : null };
}

/** Small seeded PRNG, so every run generates the same stays. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

