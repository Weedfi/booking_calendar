import { describe, expect, it } from "vitest";
import type { FeedEvent } from "./parse-ical";
import { planChannelSync, type StoredReservation } from "./plan";

const TODAY = "2031-01-15";

const event = (uid: string, startDate: string, endDate: string, summary = "CLOSED - Not available"): FeedEvent => ({
  uid,
  startDate,
  endDate,
  summary,
});

const stored = (
  e: FeedEvent,
  status: StoredReservation["status"] = "active",
): StoredReservation => ({
  externalUid: e.uid,
  startDate: e.startDate,
  endDate: e.endDate,
  summary: e.summary,
  status,
});

describe("planChannelSync", () => {
  it("inserts every event on the first sync", () => {
    const feed = [event("a", "2031-01-20", "2031-01-22"), event("b", "2031-02-01", "2031-02-03")];
    expect(planChannelSync([], feed, TODAY)).toEqual({ upserts: feed, cancelUids: [] });
  });

  it("does nothing when the feed matches the database (idempotent)", () => {
    const feed = [event("a", "2031-01-20", "2031-01-22")];
    expect(planChannelSync(feed.map((e) => stored(e)), feed, TODAY)).toEqual({ upserts: [], cancelUids: [] });
  });

  it("updates a reservation whose dates changed", () => {
    const before = event("a", "2031-01-20", "2031-01-22");
    const after = event("a", "2031-01-20", "2031-01-25");
    expect(planChannelSync([stored(before)], [after], TODAY).upserts).toEqual([after]);
  });

  it("updates a reservation whose summary changed", () => {
    const before = event("a", "2031-01-20", "2031-01-22", "Reserved");
    const after = event("a", "2031-01-20", "2031-01-22", "Airbnb (Not available)");
    expect(planChannelSync([stored(before)], [after], TODAY).upserts).toEqual([after]);
  });

  it("reactivates a cancelled reservation that reappears in the feed", () => {
    const e = event("a", "2031-01-20", "2031-01-22");
    expect(planChannelSync([stored(e, "cancelled")], [e], TODAY).upserts).toEqual([e]);
  });

  it("cancels a future reservation that disappeared from the feed", () => {
    const gone = event("gone", "2031-01-20", "2031-01-22");
    expect(planChannelSync([stored(gone)], [], TODAY).cancelUids).toEqual(["gone"]);
  });

  it("cancels a reservation starting today that disappeared", () => {
    const gone = event("gone", TODAY, "2031-01-17");
    expect(planChannelSync([stored(gone)], [], TODAY).cancelUids).toEqual(["gone"]);
  });

  it("keeps past and in-progress stays that dropped out of the feed", () => {
    const past = event("past", "2031-01-01", "2031-01-05");
    const inProgress = event("in-progress", "2031-01-14", "2031-01-18");
    expect(planChannelSync([stored(past), stored(inProgress)], [], TODAY).cancelUids).toEqual([]);
  });

  it("does not cancel a reservation that is already cancelled", () => {
    const gone = event("gone", "2031-01-20", "2031-01-22");
    expect(planChannelSync([stored(gone, "cancelled")], [], TODAY).cancelUids).toEqual([]);
  });
});
