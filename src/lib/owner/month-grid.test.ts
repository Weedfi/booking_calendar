import { describe, expect, it } from "vitest";
import { monthGrid, monthGridWindow } from "./month-grid";

const flat = (weeks: ReturnType<typeof monthGrid>) => weeks.flat();

describe("monthGrid", () => {
  it("pads the month to whole Monday-first weeks", () => {
    // February 2031 starts on a Saturday and ends on a Friday.
    const weeks = monthGrid([], "2031-02-10", "2031-02-10");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe("2031-01-27");
    expect(weeks.at(-1)!.at(-1)!.date).toBe("2031-03-02");
    expect(flat(weeks).filter((d) => d.inMonth)).toHaveLength(28);
  });

  it("marks check-in afternoon, full nights and checkout morning", () => {
    const days = flat(monthGrid([{ startDate: "2031-02-10", endDate: "2031-02-13" }], "2031-02-01", "2031-02-01"));
    const byDate = Object.fromEntries(days.map((d) => [d.date, [d.morning, d.evening]]));

    expect(byDate["2031-02-09"]).toEqual([false, false]);
    expect(byDate["2031-02-10"]).toEqual([false, true]); // check-in
    expect(byDate["2031-02-11"]).toEqual([true, true]);
    expect(byDate["2031-02-12"]).toEqual([true, true]);
    expect(byDate["2031-02-13"]).toEqual([true, false]); // checkout
  });

  it("shows a back-to-back changeover day as fully booked", () => {
    const stays = [
      { startDate: "2031-02-10", endDate: "2031-02-12" },
      { startDate: "2031-02-12", endDate: "2031-02-14" },
    ];
    const day = flat(monthGrid(stays, "2031-02-01", "2031-02-01")).find((d) => d.date === "2031-02-12")!;
    expect([day.morning, day.evening]).toEqual([true, true]);
  });

  it("uses a stay from the previous month for the first morning", () => {
    const days = flat(monthGrid([{ startDate: "2031-01-20", endDate: "2031-01-28" }], "2031-02-01", "2031-02-01"));
    expect(days[0]).toMatchObject({ date: "2031-01-27", morning: true, evening: true, inMonth: false });
    expect(days[1]).toMatchObject({ date: "2031-01-28", morning: true, evening: false });
  });

  it("flags today", () => {
    const days = flat(monthGrid([], "2031-02-01", "2031-02-14"));
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(["2031-02-14"]);
  });
});

describe("monthGridWindow", () => {
  it("covers the padded grid plus the night before it", () => {
    expect(monthGridWindow("2031-02-01")).toEqual({ from: "2031-01-26", to: "2031-03-03" });
  });
});
