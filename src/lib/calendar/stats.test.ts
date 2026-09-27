import { describe, expect, it } from "vitest";
import { formatRelative, occupancy, turnovers } from "./stats";

describe("occupancy", () => {
  const month = { start: "2031-02-01", end: "2031-03-01" }; // 28 nights

  it("counts occupied nights, excluding the checkout day", () => {
    expect(occupancy([{ startDate: "2031-02-01", endDate: "2031-02-08" }], month.start, month.end)).toBe(7 / 28);
  });

  it("clips stays that cross the month boundary", () => {
    const stays = [
      { startDate: "2031-01-28", endDate: "2031-02-03" }, // 2 nights in Feb
      { startDate: "2031-02-26", endDate: "2031-03-04" }, // 3 nights in Feb
    ];
    expect(occupancy(stays, month.start, month.end)).toBe(5 / 28);
  });

  it("counts overlapping stays once", () => {
    const stays = [
      { startDate: "2031-02-10", endDate: "2031-02-15" },
      { startDate: "2031-02-12", endDate: "2031-02-17" },
    ];
    expect(occupancy(stays, month.start, month.end)).toBe(7 / 28);
  });

  it("is 0 with no stays and 1 when fully booked", () => {
    expect(occupancy([], month.start, month.end)).toBe(0);
    expect(occupancy([{ startDate: "2031-01-20", endDate: "2031-03-10" }], month.start, month.end)).toBe(1);
  });
});

describe("turnovers", () => {
  it("lists arrivals and departures of a day", () => {
    const a = { startDate: "2031-02-10", endDate: "2031-02-12" };
    const b = { startDate: "2031-02-12", endDate: "2031-02-14" };
    expect(turnovers([a, b], "2031-02-12")).toEqual({ checkIns: [b], checkOuts: [a] });
  });
});

describe("formatRelative", () => {
  const now = new Date("2031-01-10T12:00:00Z");
  const ago = (ms: number) => formatRelative(new Date(now.getTime() - ms), now);

  it.each([
    [20_000, "przed chwilą"],
    [5 * 60_000, "5 min temu"],
    [3 * 3_600_000, "3 godz. temu"],
    [26 * 3_600_000, "1 dzień temu"],
    [72 * 3_600_000, "3 dni temu"],
  ])("formats %i ms as %s", (ms, expected) => {
    expect(ago(ms)).toBe(expected);
  });
});
