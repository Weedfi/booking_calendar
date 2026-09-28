import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBookingExport, parseDate } from "./booking-export";
import { planImport, type ImportableProperty } from "./plan";

const fixture = (name: string) =>
  readFileSync(new URL(`../../../tests/fixtures/booking-export/${name}`, import.meta.url), "utf8");

const TODAY = "2026-09-28";

const properties: ImportableProperty[] = [
  { id: "aaaaaaaa-1", name: "Marynistyczny Apartament 4-osobowy", bookingRoomName: null, channels: [{ id: "ch-mar", source: "booking" }] },
  { id: "bbbbbbbb-2", name: "Studio 6", bookingRoomName: "Pokój studio 6", channels: [{ id: "ch-studio", source: "booking" }] },
  { id: "cccccccc-3", name: "Pokój 2-osobowy z łazienką nr.1", bookingRoomName: null, channels: [{ id: "ch-p1", source: "booking" }] },
];

describe("parseBookingExport", () => {
  it("reads a Polish CSV export with semicolons, quotes and a BOM", () => {
    const result = parseBookingExport(fixture("reservations-pl.csv"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(6);
    expect(result.rows[0]).toEqual({
      number: "5500000001",
      room: "Marynistyczny Apartament 4-osobowy",
      checkIn: "2026-09-19",
      checkOut: "2026-09-20",
      cancelled: false,
    });
    expect(result.rows[1]).toMatchObject({ checkIn: "2026-09-05", checkOut: "2026-09-08" });
    expect(result.rows[2].cancelled).toBe(true);
    expect(result.rows[5]).toMatchObject({ number: "5500000006", room: "Marynistyczny Apartament 4-osobowy" });
  });

  it("reads an English 'Excel' export that is really an HTML table", () => {
    const result = parseBookingExport(fixture("reservations-en.xls"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => [r.number, r.room, r.checkIn, r.checkOut, r.cancelled])).toEqual([
      ["5500000101", "Pokój 2-osobowy z łazienką nr.1", "2026-09-19", "2026-09-21", false],
      ["5500000102", "Pokój 2-osobowy z łazienką nr.1", "2026-09-22", "2026-09-23", true],
    ]);
  });

  it("never returns guest names or prices", () => {
    const result = parseBookingExport(fixture("reservations-pl.csv"));
    expect(JSON.stringify(result)).not.toMatch(/Jan Testowy|223 PLN|Przykładowa/);
  });

  it("explains when the file is not a reservation list", () => {
    expect(parseBookingExport("a;b\n1;2")).toEqual({ ok: false, error: expect.stringContaining("Nie znaleziono kolumn") });
    expect(parseBookingExport("")).toMatchObject({ ok: false });
  });
});

describe("parseDate", () => {
  it.each([
    ["2026-09-19", "2026-09-19"],
    ["19.09.2026", "2026-09-19"],
    ["19/09/2026", "2026-09-19"],
    ["19 Sep 2026", "2026-09-19"],
    ["Sep 19, 2026", "2026-09-19"],
    ["19 wrz 2026", "2026-09-19"],
    ["2026-09-19 14:00", "2026-09-19"],
  ])("%s -> %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it("rejects nonsense", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("jutro")).toBeNull();
  });
});

describe("planImport", () => {
  const parsed = parseBookingExport(fixture("reservations-pl.csv"));
  const rows = parsed.ok ? parsed.rows : [];
  const plan = planImport(rows, properties, TODAY);

  it("imports finished, confirmed stays matched to their apartment", () => {
    expect(plan.records.map((r) => [r.property_id, r.start_date, r.end_date])).toEqual([
      ["aaaaaaaa-1", "2026-09-19", "2026-09-20"],
      ["bbbbbbbb-2", "2026-09-05", "2026-09-08"], // matched via the Booking.com room name
      ["aaaaaaaa-1", "2026-08-28", "2026-08-30"],
    ]);
    expect(plan.records[0]).toMatchObject({ channel_id: "ch-mar", source: "booking", status: "active" });
  });

  it("skips cancelled and not yet finished stays and reports unknown rooms", () => {
    expect(plan.skipped).toEqual({ cancelled: 1, notFinished: 1, unknownRooms: ["Domek na drzewie"], noChannel: [] });
  });

  it("derives stable IDs so importing twice creates no duplicates", () => {
    expect(planImport(rows, properties, TODAY).records.map((r) => r.external_uid)).toEqual(plan.records.map((r) => r.external_uid));
    expect(new Set(plan.records.map((r) => r.external_uid)).size).toBe(plan.records.length);
  });

  it("reports apartments without a channel to attach the stays to", () => {
    const noChannel = planImport(rows, [{ ...properties[0], channels: [] }], TODAY);
    expect(noChannel.records).toEqual([]);
    expect(noChannel.skipped.noChannel).toEqual(["Marynistyczny Apartament 4-osobowy"]);
  });
});
