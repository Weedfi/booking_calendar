import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidFeedError, parseIcal } from "./parse-ical";

const fixture = (name: string) =>
  readFileSync(new URL(`../../../tests/fixtures/ical/${name}`, import.meta.url), "utf8");

describe("parseIcal", () => {
  it("parses a Booking.com feed with DTEND as the exclusive checkout day", () => {
    const { events, skipped } = parseIcal(fixture("booking.ics"));

    expect(skipped).toBe(0);
    expect(events).toEqual([
      { uid: "fake-booking-0001@booking.com", startDate: "2031-01-10", endDate: "2031-01-13", summary: "CLOSED - Not available" },
      { uid: "fake-booking-0002@booking.com", startDate: "2031-01-13", endDate: "2031-01-20", summary: "CLOSED - Not available" },
      { uid: "fake-booking-0003@booking.com", startDate: "2031-01-31", endDate: "2031-02-02", summary: "CLOSED - Not available" },
    ]);
  });

  it("parses an Airbnb feed, including folded DESCRIPTION lines", () => {
    const { events } = parseIcal(fixture("airbnb.ics"));

    expect(events.map((e) => [e.startDate, e.endDate, e.summary])).toEqual([
      ["2031-03-01", "2031-03-05", "Reserved"],
      ["2031-03-10", "2031-03-12", "Airbnb (Not available)"],
    ]);
  });

  it("accepts CRLF line endings, as real feeds use", () => {
    const crlf = fixture("booking.ics").replace(/\r?\n/g, "\r\n");
    expect(parseIcal(crlf).events).toHaveLength(3);
  });

  describe("edge cases", () => {
    const { events, skipped } = parseIcal(fixture("edge-cases.ics"));
    const byUid = new Map(events.map((e) => [e.uid, e]));

    it("defaults a missing DTEND to one night", () => {
      expect(byUid.get("no-dtend@test")).toMatchObject({ startDate: "2031-04-01", endDate: "2031-04-02" });
    });

    it("extends a zero-length event to one night", () => {
      expect(byUid.get("same-day@test")).toMatchObject({ startDate: "2031-04-05", endDate: "2031-04-06" });
    });

    it("uses the event's own timezone for DATE-TIME values", () => {
      // Midnight in Warsaw is 23:00 UTC the previous day; the date must not shift.
      expect(byUid.get("datetime-warsaw@test")).toMatchObject({ startDate: "2031-04-10", endDate: "2031-04-12" });
    });

    it("returns a duplicated UID only once (node-ical keeps the last copy)", () => {
      expect(events.filter((e) => e.uid === "duplicate@test")).toHaveLength(1);
      expect(byUid.get("duplicate@test")).toMatchObject({ startDate: "2031-04-20", summary: "Second copy" });
    });

    it("stores a missing SUMMARY as null", () => {
      expect(byUid.get("no-summary@test")?.summary).toBeNull();
    });

    it("skips events that are cancelled in the feed or have no UID", () => {
      expect(byUid.has("cancelled@test")).toBe(false);
      expect(events.some((e) => e.summary === "Missing UID")).toBe(false);
      expect(skipped).toBe(2);
    });
  });

  describe("timezone independence", () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it.each(["UTC", "Europe/Warsaw", "America/Los_Angeles", "Pacific/Auckland"])(
      "returns the same all-day dates when the server runs in %s",
      (tz) => {
        process.env.TZ = tz;
        const { events } = parseIcal(fixture("booking.ics"));
        expect(events[0]).toMatchObject({ startDate: "2031-01-10", endDate: "2031-01-13" });
      },
    );
  });

  it("returns no events for an empty calendar", () => {
    expect(parseIcal("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n").events).toEqual([]);
  });

  it("rejects a response that is not iCalendar, e.g. an HTML error page", () => {
    expect(() => parseIcal("<!doctype html><title>Login</title>")).toThrow(InvalidFeedError);
  });
});
