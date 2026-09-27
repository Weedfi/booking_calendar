import { describe, expect, it } from "vitest";
import { parseAdminFilters } from "@/lib/calendar/filters";
import type { CalendarReservation } from "@/lib/calendar/tape-chart";
import { buildDashboard, type DashboardData } from "./dashboard";

const TODAY = "2031-01-15";
const NOW = new Date("2031-01-15T10:00:00Z");
const ANNA = "b0000000-0000-4000-8000-000000000001";
const MAREK = "b0000000-0000-4000-8000-000000000002";
const LOFT = "c0000000-0000-4000-8000-000000000001";
const STUDIO = "c0000000-0000-4000-8000-000000000002";
const CHALET = "c0000000-0000-4000-8000-000000000003";

let nextId = 0;
const stay = (
  propertyId: string,
  startDate: string,
  endDate: string,
  source: CalendarReservation["source"] = "booking",
): CalendarReservation => ({ id: `r${++nextId}`, propertyId, source, startDate, endDate, summary: null });

const data: DashboardData = {
  properties: [
    { id: LOFT, name: "Old Town Loft", color: "#ef4444", ownerId: ANNA, ownerName: "Anna" },
    { id: STUDIO, name: "Kazimierz Studio", color: "#f97316", ownerId: ANNA, ownerName: "Anna" },
    { id: CHALET, name: "Zakopane Chalet", color: "#8b5cf6", ownerId: MAREK, ownerName: "Marek" },
  ],
  owners: [
    { id: ANNA, name: "Anna" },
    { id: MAREK, name: "Marek" },
  ],
  channels: [
    { id: "ch1", propertyId: LOFT, source: "booking", lastSyncedAt: "2031-01-15T09:58:00Z", lastSyncError: null },
    { id: "ch2", propertyId: STUDIO, source: "booking", lastSyncedAt: "2031-01-15T09:57:00Z", lastSyncError: null },
    { id: "ch3", propertyId: STUDIO, source: "airbnb", lastSyncedAt: "2031-01-15T09:00:00Z", lastSyncError: "HTTP 404 Not Found" },
    { id: "ch4", propertyId: CHALET, source: "booking", lastSyncedAt: null, lastSyncError: null },
  ],
  reservations: [
    stay(LOFT, "2031-01-12", "2031-01-15"), // checks out today
    stay(LOFT, "2031-01-15", "2031-01-18"), // checks in today
    stay(STUDIO, "2031-01-16", "2031-01-20", "airbnb"), // checks in tomorrow
    stay(CHALET, "2031-01-01", "2031-02-01"), // whole month
  ],
};

const build = (params: Record<string, string> = {}) =>
  buildDashboard(data, parseAdminFilters(params, TODAY), TODAY, NOW);

describe("buildDashboard", () => {
  it("shows every property when no filter is set", () => {
    const dashboard = build();
    expect(dashboard.rows.map((r) => r.property.name)).toEqual(["Old Town Loft", "Kazimierz Studio", "Zakopane Chalet"]);
    expect(dashboard.days).toHaveLength(14);
  });

  it("filters properties by owner", () => {
    expect(build({ owner: MAREK }).rows.map((r) => r.property.id)).toEqual([CHALET]);
  });

  it("drops a property filter that belongs to another owner", () => {
    const dashboard = build({ owner: MAREK, property: LOFT });
    expect(dashboard.filters.propertyId).toBeNull();
    expect(dashboard.rows.map((r) => r.property.id)).toEqual([CHALET]);
  });

  it("filters reservations by channel", () => {
    const dashboard = build({ channel: "airbnb" });
    const bars = dashboard.rows.flatMap((r) => r.layout.bars.map((b) => b.reservation.source));
    expect(bars).toEqual(["airbnb"]);
  });

  it("lists today's check-outs and check-ins and tomorrow's arrivals", () => {
    const [today, tomorrow] = build().turnovers;
    expect(today.day).toBe(TODAY);
    expect(today.checkOuts.map((t) => t.property.name)).toEqual(["Old Town Loft"]);
    expect(today.checkIns.map((t) => t.property.name)).toEqual(["Old Town Loft"]);
    expect(tomorrow.checkIns.map((t) => t.property.name)).toEqual(["Kazimierz Studio"]);
  });

  it("computes monthly occupancy per property", () => {
    const chalet = build().rows.find((r) => r.property.id === CHALET)!;
    expect(chalet.occupancy).toBe(1);
  });

  it("summarizes sync status per property", () => {
    const rows = Object.fromEntries(build().rows.map((r) => [r.property.id, r.sync]));
    expect(rows[LOFT]).toEqual({ state: "ok", label: "Sync. 2 min temu" });
    expect(rows[STUDIO]).toEqual({ state: "error", label: "Sync. 1 godz. temu", errors: ["airbnb: HTTP 404 Not Found"] });
    expect(rows[CHALET]).toEqual({ state: "never", label: "Nigdy nie synchronizowano" });
  });
});

describe("buildDashboard with a property closed for sale", () => {
  // What Booking.com exports for a closed apartment: one block until the feed ends.
  const closed: DashboardData = {
    ...data,
    reservations: [...data.reservations, stay(LOFT, "2031-01-20", "2032-07-20")],
  };
  const dashboard = buildDashboard(closed, parseAdminFilters({}, TODAY), TODAY, NOW);
  const loft = dashboard.rows.find((r) => r.property.id === LOFT)!;

  it("draws the block as a closure, not as a stay", () => {
    expect(loft.closures).toHaveLength(1);
    expect(loft.layout.bars.map((b) => b.reservation.endDate)).toEqual(["2031-01-15", "2031-01-18"]);
  });

  it("counts occupancy over open nights only", () => {
    // January: 19 open nights (1–19), 6 of them booked (12–14 and 15–17).
    expect(loft.occupancy).toBeCloseTo(6 / 19);
  });

  it("never lists the closure as a check-in", () => {
    const checkIns = dashboard.turnovers.flatMap((d) => d.checkIns.map((c) => c.reservation.endDate));
    expect(checkIns).not.toContain("2032-07-20");
  });

  it("shows no occupancy for a month that is entirely closed", () => {
    const march = buildDashboard(closed, parseAdminFilters({ from: "2031-03-03" }, TODAY), TODAY, NOW);
    expect(march.rows.find((r) => r.property.id === LOFT)!.occupancy).toBeNull();
  });
});
