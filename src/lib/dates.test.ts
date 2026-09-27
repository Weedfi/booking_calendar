import { describe, expect, it } from "vitest";
import { addDays, daysBetween, eachDay, formatDate, isDateKey, monthRange, startOfWeek, todayKey } from "./dates";

describe("dates", () => {
  it("validates date keys, including impossible dates", () => {
    expect(isDateKey("2031-02-28")).toBe(true);
    expect(isDateKey("2031-02-30")).toBe(false);
    expect(isDateKey("2031-2-3")).toBe(false);
    expect(isDateKey("<script>")).toBe(false);
  });

  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2031-01-31", 1)).toBe("2031-02-01");
    expect(addDays("2031-12-31", 1)).toBe("2032-01-01");
    expect(addDays("2031-03-30", 1)).toBe("2031-03-31"); // EU clocks change on 2031-03-30
    expect(addDays("2031-03-01", -1)).toBe("2031-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2031-01-10", "2031-01-13")).toBe(3);
    expect(daysBetween("2031-01-13", "2031-01-10")).toBe(-3);
    expect(daysBetween("2031-03-29", "2031-04-02")).toBe(4);
  });

  it("lists consecutive days", () => {
    expect(eachDay("2031-01-30", 3)).toEqual(["2031-01-30", "2031-01-31", "2031-02-01"]);
  });

  it("returns the month as a half-open range", () => {
    expect(monthRange("2031-02-14")).toEqual({ start: "2031-02-01", end: "2031-03-01" });
    expect(monthRange("2031-12-05")).toEqual({ start: "2031-12-01", end: "2032-01-01" });
  });

  it("finds the Monday of the week", () => {
    expect(startOfWeek("2031-01-15")).toBe("2031-01-13"); // Wednesday
    expect(startOfWeek("2031-01-13")).toBe("2031-01-13"); // Monday
    expect(startOfWeek("2031-01-19")).toBe("2031-01-13"); // Sunday
  });

  it("uses Warsaw time for today", () => {
    expect(todayKey(new Date("2031-01-10T23:30:00Z"))).toBe("2031-01-11");
  });

  it("formats dates without timezone shifts", () => {
    expect(formatDate("2031-02-03")).toBe("pon., 3 lut");
  });
});
