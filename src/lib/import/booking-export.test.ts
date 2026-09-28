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
      guestName: "Jan Testowy",
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

  it("reads the guest's name but never prices", () => {
    const result = parseBookingExport(fixture("reservations-pl.csv"));
    expect(result.ok && result.rows.map((r) => r.guestName)).toEqual([
      "Jan Testowy",
      "Anna Przykładowa",
      "Ktoś Anulujący",
      "Przyszły Gość",
      "Nieznany Pokój",
      'Gość "Cytat"',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/PLN|223|600/);
  });

  it("reads the guest column of the English export", () => {
    const result = parseBookingExport(fixture("reservations-en.xls"));
    expect(result.ok && result.rows.map((r) => r.guestName)).toEqual(["Test Guest", "Other & Guest"]);
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

  it("keeps guest names for past and future stays, but not for cancelled ones", () => {
    expect(plan.guests).toEqual([
      { property_id: "aaaaaaaa-1", start_date: "2026-09-19", end_date: "2026-09-20", guest_name: "Jan Testowy" },
      { property_id: "bbbbbbbb-2", start_date: "2026-09-05", end_date: "2026-09-08", guest_name: "Anna Przykładowa" },
      { property_id: "bbbbbbbb-2", start_date: "2026-10-10", end_date: "2026-10-12", guest_name: "Przyszły Gość" },
      { property_id: "aaaaaaaa-1", start_date: "2026-08-28", end_date: "2026-08-30", guest_name: 'Gość "Cytat"' },
    ]);
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
    // Names still work: they belong to the apartment, not to a channel.
    expect(noChannel.guests.map((g) => g.guest_name)).toEqual(["Jan Testowy", 'Gość "Cytat"']);
    expect(noChannel.skipped.noChannel).toEqual(["Marynistyczny Apartament 4-osobowy"]);
  });
});

describe("the real Booking.com export format", () => {
  // Same header as a real Polish export; the rows are made up.
  const result = parseBookingExport(fixture("reservations-pl-real-header.csv"));
  const rows = result.ok ? result.rows : [];

  it("reads the room from 'Rodzaj opcji zakwaterowania', not the room count", () => {
    expect(rows.map((r) => r.room)).toEqual([
      "Apartament Czerwony nr.2",
      "Pokój dwuosobowy z łazienką nr.1",
      "Apartament Czerwony nr.2",
    ]);
  });

  it("reads the guest from 'Imię i nazwisko gości(a)'", () => {
    expect(rows.map((r) => r.guestName)).toEqual(["Testowy Jan", "Nowak Anna", "Anulujący Ktoś"]);
    expect(rows[2].cancelled).toBe(true);
  });

  it("never assigns a stay to an apartment by a fragment like a room number", () => {
    const apartments: ImportableProperty[] = [
      { id: "p-nr1", name: "Pokój 2-osobowy z łazienką nr.1", bookingRoomName: null, channels: [{ id: "c1", source: "booking" }] },
      { id: "p-nr2", name: "Pokój dwuosobowy z łazienką nr.2", bookingRoomName: null, channels: [{ id: "c2", source: "booking" }] },
    ];
    const plan = planImport(rows, apartments, "2026-09-28");
    // Neither room name in the file is an apartment in the app: nothing may be guessed.
    expect(plan.records).toEqual([]);
    expect(plan.guests).toEqual([]);
    expect(plan.skipped.unknownRooms).toEqual(["Apartament Czerwony nr.2", "Pokój dwuosobowy z łazienką nr.1"]);
  });

  it("matches once the Booking.com room name is set on the apartment", () => {
    const apartments: ImportableProperty[] = [
      { id: "p-red", name: "Czerwony", bookingRoomName: "Apartament Czerwony nr.2", channels: [{ id: "c-red", source: "booking" }] },
    ];
    const plan = planImport(rows, apartments, "2026-09-28");
    expect(plan.records.map((r) => [r.property_id, r.start_date])).toEqual([["p-red", "2025-09-13"]]);
    expect(plan.guests.map((g) => g.guest_name)).toEqual(["Testowy Jan"]);
  });
});
