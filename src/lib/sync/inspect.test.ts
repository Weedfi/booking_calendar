import { describe, expect, it } from "vitest";
import { compareFeed } from "./inspect";

const ev = (uid: string, startDate: string, endDate: string) => ({ uid, startDate, endDate, summary: "CLOSED - Not available" });
const st = (externalUid: string, startDate: string, endDate: string) => ({ externalUid, startDate, endDate, summary: null });

describe("compareFeed", () => {
  const today = "2026-10-25";

  it("marks events present in both the feed and the app", () => {
    expect(compareFeed([ev("a", "2026-11-01", "2026-11-03")], [st("a", "2026-11-01", "2026-11-03")], today)).toEqual([
      { startDate: "2026-11-01", endDate: "2026-11-03", summary: "CLOSED - Not available", inFeed: true, inApp: true },
    ]);
  });

  it("flags a feed event the app does not have yet", () => {
    expect(compareFeed([ev("b", "2026-11-05", "2026-11-06")], [], today)[0]).toMatchObject({ inFeed: true, inApp: false });
  });

  it("flags app dates the feed no longer has, and moved dates on both sides", () => {
    const rows = compareFeed([ev("a", "2026-11-01", "2026-11-04")], [st("a", "2026-11-01", "2026-11-03"), st("c", "2026-12-01", "2026-12-02")], today);
    expect(rows.map((r) => [r.startDate, r.endDate, r.inFeed, r.inApp])).toEqual([
      ["2026-11-01", "2026-11-03", false, true],
      ["2026-11-01", "2026-11-04", true, false],
      ["2026-12-01", "2026-12-02", false, true],
    ]);
  });

  it("leaves out stays that are already over", () => {
    expect(compareFeed([ev("old", "2026-10-01", "2026-10-25")], [st("old", "2026-10-01", "2026-10-25")], today)).toEqual([]);
  });
});
