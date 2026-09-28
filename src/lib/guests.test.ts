import { describe, expect, it } from "vitest";
import { guestsFor, withGuests, type GuestStay } from "./guests";

const guest = (startDate: string, endDate: string, guestName: string, propertyId = "p1"): GuestStay => ({
  propertyId,
  startDate,
  endDate,
  guestName,
  source: "email",
});

describe("guestsFor", () => {
  const reservation = { propertyId: "p1", startDate: "2026-10-10", endDate: "2026-10-13" };

  it("finds the guest with the same apartment and dates", () => {
    expect(guestsFor(reservation, [guest("2026-10-10", "2026-10-13", "Jan Kowalski")])).toEqual(["Jan Kowalski"]);
  });

  it("lists every guest inside a merged Booking.com block, in date order", () => {
    const block = { propertyId: "p1", startDate: "2026-10-10", endDate: "2026-10-20" };
    const guests = [guest("2026-10-15", "2026-10-20", "Anna Nowak"), guest("2026-10-10", "2026-10-15", "Jan Kowalski")];
    expect(guestsFor(block, guests)).toEqual(["Jan Kowalski", "Anna Nowak"]);
  });

  it("ignores other apartments and stays outside the reservation", () => {
    const guests = [
      guest("2026-10-10", "2026-10-13", "Other Room", "p2"),
      guest("2026-10-09", "2026-10-13", "Starts Earlier"),
      guest("2026-10-13", "2026-10-15", "Next Guest"),
    ];
    expect(guestsFor(reservation, guests)).toEqual([]);
  });
});

describe("withGuests", () => {
  it("adds the names to each reservation", () => {
    const reservations = [{ id: "r1", propertyId: "p1", startDate: "2026-10-10", endDate: "2026-10-13" }];
    expect(withGuests(reservations, [guest("2026-10-10", "2026-10-13", "Jan Kowalski")])).toEqual([
      { ...reservations[0], guests: ["Jan Kowalski"] },
    ]);
  });
});
