import { describe, expect, it } from "vitest";
import { buildOwnerView, parseOwnerParams, type OwnerStay } from "./view";

const TODAY = "2031-02-12";
const loft = { id: "p1", name: "Old Town Loft", address: null, color: "#ef4444" };

const stay = (id: string, startDate: string, endDate: string): OwnerStay => ({ id, source: "booking", startDate, endDate });

describe("parseOwnerParams", () => {
  it("defaults to the current month", () => {
    expect(parseOwnerParams({}, TODAY)).toEqual({ propertyId: null, month: "2031-02-01" });
  });

  it("reads a valid month and ignores an invalid one", () => {
    expect(parseOwnerParams({ month: "2031-11", property: "p1" }, TODAY)).toEqual({ propertyId: "p1", month: "2031-11-01" });
    expect(parseOwnerParams({ month: "2031-13" }, TODAY).month).toBe("2031-02-01");
  });
});

describe("buildOwnerView", () => {
  const monthStays = [stay("a", "2031-02-10", "2031-02-14"), stay("b", "2031-02-20", "2031-02-27")];
  const upcoming = [stay("a", "2031-02-10", "2031-02-14"), stay("b", "2031-02-20", "2031-02-27")];
  const view = buildOwnerView([loft], loft, monthStays, upcoming, "2031-02-01", TODAY);

  it("computes booked nights and occupancy for the month", () => {
    expect(view.bookedNights).toBe(11);
    expect(view.occupancy).toBeCloseTo(11 / 28);
  });

  it("separates the current stay from the upcoming ones", () => {
    expect(view.current?.id).toBe("a");
    expect(view.upcoming.map((s) => s.id)).toEqual(["b"]);
  });

  it("links to the previous and next month", () => {
    expect(view.prevMonth).toBe("2031-01-01");
    expect(view.nextMonth).toBe("2031-03-01");
  });
});

describe("buildOwnerView while closed for sale", () => {
  const closure = stay("closed", "2031-02-12", "2032-08-12");
  const view = buildOwnerView([loft], loft, [stay("a", "2031-02-10", "2031-02-12"), closure], [closure], "2031-02-01", TODAY);

  it("says until when the property is closed", () => {
    expect(view.closedUntil).toBe("2032-08-12");
  });

  it("does not treat the closure as a guest staying or an upcoming stay", () => {
    expect(view.current).toBeNull();
    expect(view.upcoming).toEqual([]);
  });

  it("counts occupancy over the open nights only", () => {
    // February: 11 open nights (1–11), 2 of them booked.
    expect(view.bookedNights).toBe(2);
    expect(view.occupancy).toBeCloseTo(2 / 11);
  });
});
