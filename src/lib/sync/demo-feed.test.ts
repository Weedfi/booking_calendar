import { describe, expect, it } from "vitest";
import { generateDemoFeed } from "./demo-feed";
import { parseIcal } from "./parse-ical";

const TODAY = "2026-09-25";
const booking = "demo://1000002/booking?channels=booking,airbnb";
const airbnb = "demo://1000002/airbnb?channels=booking,airbnb";

describe("generateDemoFeed", () => {
  it("produces a valid feed around today", () => {
    const { events } = parseIcal(generateDemoFeed(booking, TODAY));
    expect(events.length).toBeGreaterThan(10);
    expect(events.every((e) => e.endDate > "2026-07-27" && e.startDate < "2027-03-24")).toBe(true);
    expect(events[0].summary).toBe("CLOSED - Not available");
  });

  it("is deterministic", () => {
    expect(generateDemoFeed(booking, TODAY)).toBe(generateDemoFeed(booking, TODAY));
  });

  it("keeps dates and UIDs stable from one day to the next", () => {
    const today = parseIcal(generateDemoFeed(booking, TODAY)).events;
    const tomorrow = new Map(parseIcal(generateDemoFeed(booking, "2026-09-26")).events.map((e) => [e.uid, e]));
    const future = today.filter((e) => e.startDate > "2026-10-01");
    expect(future.every((e) => tomorrow.get(e.uid)?.startDate === e.startDate)).toBe(true);
  });

  it("splits one property's stays across its channels without overlaps", () => {
    const all = [...parseIcal(generateDemoFeed(booking, TODAY)).events, ...parseIcal(generateDemoFeed(airbnb, TODAY)).events].sort(
      (a, b) => a.startDate.localeCompare(b.startDate),
    );
    expect(all.some((e) => e.uid.endsWith("@airbnb.demo"))).toBe(true);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].startDate >= all[i - 1].endDate).toBe(true);
    }
  });

  it("can simulate a broken feed", () => {
    expect(() => generateDemoFeed(`${airbnb}&fail=404`, TODAY)).toThrow("HTTP 404 Not Found");
  });

  it("rejects malformed demo URLs", () => {
    expect(() => generateDemoFeed("demo://1000002/vrbo?channels=booking", TODAY)).toThrow();
  });
});
