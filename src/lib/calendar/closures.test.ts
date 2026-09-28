import { describe, expect, it } from "vitest";
import { closedUntil, isClosure, openOccupancy, splitClosures } from "./closures";

const stay = (startDate: string, endDate: string) => ({ startDate, endDate });

describe("isClosure", () => {
  it("treats a Booking.com 'closed for sale' block as a closure", () => {
    // What Booking.com exported for a closed apartment: today until the feed ends.
    expect(isClosure(stay("2026-09-28", "2028-03-28"))).toBe(true);
  });

  it("keeps normal and long stays as stays", () => {
    expect(isClosure(stay("2026-10-01", "2026-10-04"))).toBe(false);
    expect(isClosure(stay("2026-10-01", "2026-10-29"))).toBe(false); // 28 nights, a long stay
  });

  it("treats blocks of more than 30 nights as closures", () => {
    expect(isClosure(stay("2026-10-01", "2026-10-31"))).toBe(false); // 30
    expect(isClosure(stay("2026-10-01", "2026-11-01"))).toBe(true); // 31
  });
});

describe("splitClosures", () => {
  it("separates stays from closures", () => {
    const short = stay("2026-10-01", "2026-10-03");
    const closed = stay("2026-11-01", "2027-06-01");
    expect(splitClosures([short, closed])).toEqual({ stays: [short], closures: [closed] });
  });
});

describe("openOccupancy", () => {
  const october = { start: "2026-10-01", end: "2026-11-01" }; // 31 nights

  it("equals plain occupancy when nothing is closed", () => {
    expect(openOccupancy([stay("2026-10-01", "2026-10-11")], [], october.start, october.end)).toBe(10 / 31);
  });

  it("only counts open nights", () => {
    // Closed from the 21st: 20 open nights, 10 of them booked.
    const closures = [stay("2026-10-21", "2027-03-01")];
    expect(openOccupancy([stay("2026-10-01", "2026-10-11")], closures, october.start, october.end)).toBe(10 / 20);
  });

  it("still counts bookings from another channel inside a closure", () => {
    // Closed on Booking.com all month, 7 nights sold on Airbnb: 7 of 7 sellable nights booked.
    const closures = [stay("2026-09-28", "2028-03-28")];
    expect(openOccupancy([stay("2026-10-05", "2026-10-12")], closures, october.start, october.end)).toBe(1);
  });

  it("is null when the whole month is closed", () => {
    expect(openOccupancy([], [stay("2026-09-28", "2028-03-28")], october.start, october.end)).toBeNull();
  });
});

describe("closedUntil", () => {
  const closures = [stay("2026-09-28", "2028-03-28")];

  it("returns the end of the closure covering the day", () => {
    expect(closedUntil(closures, "2026-10-05")).toBe("2028-03-28");
  });

  it("returns null outside closures", () => {
    expect(closedUntil(closures, "2026-09-27")).toBeNull();
    expect(closedUntil(closures, "2028-03-28")).toBeNull();
  });
});
