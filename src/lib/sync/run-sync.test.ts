import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../../tests/support/memory-store";
import { FeedFetchError } from "./fetch-ical";
import { runSync } from "./run-sync";
import type { SyncChannel } from "./store";

const fixture = (name: string) =>
  readFileSync(new URL(`../../../tests/fixtures/ical/${name}`, import.meta.url), "utf8");

const booking: SyncChannel = { id: "ch-booking", propertyId: "prop-1", source: "booking", icalUrl: "https://feeds.test/booking.ics" };
const airbnb: SyncChannel = { id: "ch-airbnb", propertyId: "prop-1", source: "airbnb", icalUrl: "https://feeds.test/airbnb.ics" };
const other: SyncChannel = { id: "ch-other", propertyId: "prop-2", source: "booking", icalUrl: "https://feeds.test/other.ics" };

// 10:00 in Warsaw on 2031-01-05, before every stay in the fixtures.
const NOW = new Date("2031-01-05T09:00:00Z");

/** Fake fetch that serves feeds from a map, so tests can change them between runs. */
function fakeFeeds(feeds: Record<string, string | Error>) {
  const calls: string[] = [];
  const fetchIcal = async (url: string) => {
    calls.push(url);
    const feed = feeds[url];
    if (feed === undefined) throw new FeedFetchError("HTTP 404 Not Found");
    if (feed instanceof Error) throw feed;
    return feed;
  };
  return { feeds, calls, fetchIcal };
}

describe("runSync", () => {
  it("imports all events from every channel", async () => {
    const mem = createMemoryStore([booking, airbnb]);
    const { fetchIcal } = fakeFeeds({ [booking.icalUrl]: fixture("booking.ics"), [airbnb.icalUrl]: fixture("airbnb.ics") });

    const result = await runSync({ trigger: "cron" }, { store: mem.store, fetchIcal, now: () => NOW });

    expect(result.ok).toBe(true);
    expect(mem.reservations(booking.id)).toHaveLength(3);
    expect(mem.reservations(airbnb.id)).toHaveLength(2);
    expect(mem.reservations(airbnb.id)[0]).toMatchObject({ propertyId: "prop-1", status: "active" });
  });

  it("is idempotent: a second run with the same feed writes nothing", async () => {
    const mem = createMemoryStore([booking]);
    const { fetchIcal } = fakeFeeds({ [booking.icalUrl]: fixture("booking.ics") });
    const deps = { store: mem.store, fetchIcal, now: () => NOW };

    await runSync({ trigger: "cron" }, deps);
    const writesAfterFirstRun = mem.writeCount();
    const second = await runSync({ trigger: "cron" }, deps);

    expect(mem.writeCount()).toBe(writesAfterFirstRun);
    expect(second.channels[0]).toMatchObject({ ok: true, upserted: 0, cancelled: 0 });
  });

  it("cancels a future booking that disappears from the feed and updates a changed one", async () => {
    const mem = createMemoryStore([booking]);
    const { feeds, fetchIcal } = fakeFeeds({ [booking.icalUrl]: fixture("booking.ics") });
    const deps = { store: mem.store, fetchIcal, now: () => NOW };
    await runSync({ trigger: "cron" }, deps);

    // Guest 0001 cancels; guest 0003 extends their stay by a night.
    feeds[booking.icalUrl] = fixture("booking.ics")
      .replace(/BEGIN:VEVENT\nDTSTAMP:20310101T090000Z\nDTSTART;VALUE=DATE:20310110[\s\S]*?END:VEVENT\n/, "")
      .replace("DTEND;VALUE=DATE:20310202", "DTEND;VALUE=DATE:20310203");
    const result = await runSync({ trigger: "email" }, deps);

    expect(result.channels[0]).toMatchObject({ ok: true, upserted: 1, cancelled: 1 });
    const byUid = new Map(mem.reservations(booking.id).map((r) => [r.externalUid, r]));
    expect(byUid.get("fake-booking-0001@booking.com")?.status).toBe("cancelled");
    expect(byUid.get("fake-booking-0003@booking.com")?.endDate).toBe("2031-02-03");
    expect(byUid.get("fake-booking-0002@booking.com")?.writes).toBe(1);
  });

  it("keeps going when one channel fails, and records the error on that channel", async () => {
    const mem = createMemoryStore([booking, airbnb, other]);
    const { fetchIcal } = fakeFeeds({
      [booking.icalUrl]: fixture("booking.ics"),
      [airbnb.icalUrl]: new FeedFetchError("Timed out after 15 s"),
      [other.icalUrl]: "<html>Service unavailable</html>",
    });

    const result = await runSync({ trigger: "cron" }, { store: mem.store, fetchIcal, now: () => NOW });

    expect(result.ok).toBe(false);
    expect(mem.reservations(booking.id)).toHaveLength(3);
    expect(mem.channelState(booking.id)).toEqual({ lastSyncedAt: NOW, lastSyncError: null });
    expect(mem.channelState(airbnb.id)).toEqual({ lastSyncedAt: null, lastSyncError: "Timed out after 15 s" });
    expect(mem.channelState(other.id).lastSyncError).toBe("Response is not an iCalendar feed");
    expect(mem.syncEvents[0]).toMatchObject({
      trigger: "cron",
      ok: false,
      error: "2 of 3 channels failed: Timed out after 15 s; Response is not an iCalendar feed",
    });
  });

  it("clears a previous channel error after a successful sync", async () => {
    const mem = createMemoryStore([booking]);
    const { feeds, fetchIcal } = fakeFeeds({ [booking.icalUrl]: new FeedFetchError("HTTP 500 Internal Server Error") });
    const deps = { store: mem.store, fetchIcal, now: () => NOW };

    await runSync({ trigger: "cron" }, deps);
    expect(mem.channelState(booking.id).lastSyncError).toBe("HTTP 500 Internal Server Error");

    feeds[booking.icalUrl] = fixture("booking.ics");
    await runSync({ trigger: "cron" }, deps);
    expect(mem.channelState(booking.id)).toEqual({ lastSyncedAt: NOW, lastSyncError: null });
  });

  it("syncs only the requested property's channels and logs it on the sync event", async () => {
    const mem = createMemoryStore([booking, airbnb, other]);
    const { calls, fetchIcal } = fakeFeeds({ [other.icalUrl]: fixture("booking.ics") });

    await runSync({ trigger: "email", propertyIds: ["prop-2"] }, { store: mem.store, fetchIcal, now: () => NOW });

    expect(calls).toEqual([other.icalUrl]);
    expect(mem.syncEvents[0]).toMatchObject({ trigger: "email", propertyId: "prop-2", ok: true, error: null });
  });

  it("uses the Warsaw date as 'today', not the server's UTC date", async () => {
    // 23:30 UTC on Jan 10 is already Jan 11 in Warsaw, so the stay that
    // started Jan 10 is in progress and must not be cancelled when it leaves
    // the feed. Using the UTC date would wrongly cancel it.
    const mem = createMemoryStore([booking]);
    const { feeds, fetchIcal } = fakeFeeds({ [booking.icalUrl]: fixture("booking.ics") });
    await runSync({ trigger: "cron" }, { store: mem.store, fetchIcal, now: () => NOW });

    feeds[booking.icalUrl] = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n";
    const lateEvening = new Date("2031-01-10T23:30:00Z");
    await runSync({ trigger: "cron" }, { store: mem.store, fetchIcal, now: () => lateEvening });

    const statuses = Object.fromEntries(mem.reservations(booking.id).map((r) => [r.externalUid, r.status]));
    expect(statuses).toEqual({
      "fake-booking-0001@booking.com": "active",
      "fake-booking-0002@booking.com": "cancelled",
      "fake-booking-0003@booking.com": "cancelled",
    });
  });
});
