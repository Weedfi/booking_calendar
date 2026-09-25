import { describe, expect, it } from "vitest";
import { layoutProperty, type CalendarReservation } from "./tape-chart";

let nextId = 0;
const stay = (
  startDate: string,
  endDate: string,
  source: CalendarReservation["source"] = "booking",
): CalendarReservation => ({
  id: `r${++nextId}`,
  propertyId: "p1",
  source,
  startDate,
  endDate,
  summary: null,
});

// A 7-day range: Mon 13 Jan .. Sun 19 Jan 2031, i.e. half-columns 0..14.
const FROM = "2031-01-13";

describe("layoutProperty", () => {
  it("runs a bar from the afternoon of check-in to the morning of checkout", () => {
    const { bars } = layoutProperty([stay("2031-01-14", "2031-01-16")], FROM, 7);
    expect(bars[0]).toMatchObject({ startHalf: 3, endHalf: 7, lane: 0, clippedStart: false, clippedEnd: false });
  });

  it("puts back-to-back stays in the same lane without overlap", () => {
    const { bars, laneCount } = layoutProperty(
      [stay("2031-01-14", "2031-01-16"), stay("2031-01-16", "2031-01-18")],
      FROM,
      7,
    );
    expect(laneCount).toBe(1);
    expect(bars.map((b) => [b.startHalf, b.endHalf, b.lane])).toEqual([
      [3, 7, 0],
      [7, 11, 0],
    ]);
  });

  it("stacks overlapping stays (double booking) in separate lanes", () => {
    const { bars, laneCount } = layoutProperty(
      [stay("2031-01-14", "2031-01-17", "booking"), stay("2031-01-15", "2031-01-16", "airbnb")],
      FROM,
      7,
    );
    expect(laneCount).toBe(2);
    expect(bars.map((b) => [b.reservation.source, b.lane])).toEqual([
      ["booking", 0],
      ["airbnb", 1],
    ]);
  });

  it("clips stays that extend beyond the visible range", () => {
    const { bars } = layoutProperty([stay("2031-01-10", "2031-01-25")], FROM, 7);
    expect(bars[0]).toMatchObject({ startHalf: 0, endHalf: 14, clippedStart: true, clippedEnd: true });
  });

  it("shows the checkout morning of a stay ending on the first visible day", () => {
    const { bars } = layoutProperty([stay("2031-01-10", FROM)], FROM, 7);
    expect(bars[0]).toMatchObject({ startHalf: 0, endHalf: 1 });
  });

  it("shows the check-in afternoon of a stay starting on the last visible day", () => {
    const { bars } = layoutProperty([stay("2031-01-19", "2031-01-22")], FROM, 7);
    expect(bars[0]).toMatchObject({ startHalf: 13, endHalf: 14, clippedEnd: true });
  });

  it("leaves out stays entirely outside the range", () => {
    const { bars, laneCount } = layoutProperty(
      [stay("2031-01-01", "2031-01-12"), stay("2031-01-20", "2031-01-22")],
      FROM,
      7,
    );
    expect(bars).toEqual([]);
    expect(laneCount).toBe(1);
  });
});
