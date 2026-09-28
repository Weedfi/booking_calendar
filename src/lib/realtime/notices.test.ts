import { describe, expect, it } from "vitest";
import { batchMessages, noticeText, toNotice, type ReservationRow } from "./notices";

const row = (overrides: Partial<ReservationRow> = {}): ReservationRow => ({
  id: "r1",
  property_id: "loft",
  start_date: "2026-10-09",
  end_date: "2026-10-12",
  status: "active",
  ...overrides,
});

describe("toNotice", () => {
  it("reports a new active reservation", () => {
    expect(toNotice({ eventType: "INSERT", new: row(), old: {} })).toEqual({
      kind: "new",
      propertyId: "loft",
      startDate: "2026-10-09",
      endDate: "2026-10-12",
    });
  });

  // Realtime sends only the primary key of the old row when RLS is on.
  const oldKey = { id: "r1" };

  it("reports a cancellation", () => {
    expect(toNotice({ eventType: "UPDATE", old: oldKey, new: row({ status: "cancelled" }) })?.kind).toBe("cancelled");
  });

  it("reports other updates of an active booking (new dates or reactivation)", () => {
    expect(toNotice({ eventType: "UPDATE", old: oldKey, new: row({ end_date: "2026-10-14" }) })?.kind).toBe("updated");
  });

  it("ignores deletes, cancelled inserts and incomplete rows", () => {
    expect(toNotice({ eventType: "DELETE", old: oldKey, new: {} })).toBeNull();
    expect(toNotice({ eventType: "INSERT", new: row({ status: "cancelled" }), old: {} })).toBeNull();
    expect(toNotice({ eventType: "INSERT", new: { id: "x" }, old: {} })).toBeNull();
  });
});

describe("messages", () => {
  const notice = toNotice({ eventType: "INSERT", new: row(), old: {} })!;

  it("names the property and dates", () => {
    expect(noticeText(notice, "Old Town Loft")).toBe("Nowa rezerwacja: Old Town Loft, pt., 9 paź → pon., 12 paź");
    expect(noticeText(notice, undefined)).toBe("Nowa rezerwacja: mieszkanie, pt., 9 paź → pon., 12 paź");
  });

  it("shows up to three notices one by one and summarizes bigger bursts", () => {
    const names = { loft: "Old Town Loft", studio: "Kazimierz Studio" };
    expect(batchMessages([notice, notice], names)).toHaveLength(2);
    const burst = [notice, notice, { ...notice, propertyId: "studio" }, notice];
    expect(batchMessages(burst, names)).toEqual(["Zmiany w rezerwacjach: 4 (2 mieszkania)"]);
  });
});

describe("closures in live notices", () => {
  const closure = row({ start_date: "2026-09-28", end_date: "2028-03-28" });

  it("reports a closure as closed for sale, not as a new booking", () => {
    expect(toNotice({ eventType: "INSERT", new: closure, old: {} })?.kind).toBe("closed");
    expect(noticeText(toNotice({ eventType: "INSERT", new: closure, old: {} })!, "Loft")).toMatch(/^Zablokowano: Loft/);
  });

  it("reports a cancelled closure as reopened", () => {
    expect(toNotice({ eventType: "UPDATE", new: { ...closure, status: "cancelled" }, old: { id: "r1" } })?.kind).toBe("reopened");
  });
});
