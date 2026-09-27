import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchProperty, type MatchableProperty } from "./match";

const email = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../tests/fixtures/emails/${name}.json`, import.meta.url), "utf8")) as {
    subject: string;
    text: string;
  };

const properties: MatchableProperty[] = [
  { id: "wawel", name: "Wawel View Apartment", bookingPropertyId: "1000003" },
  { id: "kazimierz", name: "Kazimierz Studio", bookingPropertyId: "1000002" },
  { id: "gubalowka", name: "Gubałówka Panorama", bookingPropertyId: "1000014" },
  { id: "loft", name: "Old Town Loft", bookingPropertyId: "1000001" },
  { id: "town-loft", name: "Town Loft", bookingPropertyId: null },
];

const match = (fixture: string) => {
  const { subject, text } = email(fixture);
  return matchProperty(subject, text, properties);
};

describe("matchProperty with fake Booking.com emails", () => {
  it("matches by Booking.com property ID first", () => {
    expect(match("new-booking-with-id")).toEqual({ propertyId: "wawel", matchedBy: "booking_id" });
  });

  it("falls back to the property name", () => {
    expect(match("modification-name-only")).toEqual({ propertyId: "kazimierz", matchedBy: "name" });
  });

  it("ignores case and Polish diacritics in names", () => {
    expect(match("cancellation-polish")).toEqual({ propertyId: "gubalowka", matchedBy: "name" });
  });

  it("syncs everything when the format is unknown", () => {
    expect(match("unknown-format")).toEqual({ propertyId: null, matchedBy: "none" });
  });
});

describe("matchProperty edge cases", () => {
  it("does not treat a booking number as a property ID", () => {
    expect(matchProperty("Booking 4012345678", "", properties)).toEqual({ propertyId: null, matchedBy: "none" });
  });

  it("prefers the most specific name", () => {
    expect(matchProperty("Cancelled: Old Town Loft", "", properties)).toEqual({ propertyId: "loft", matchedBy: "name" });
  });

  it("only matches whole words", () => {
    expect(matchProperty("Kazimierz Studios Ltd", "", properties).matchedBy).toBe("none");
  });

  it("syncs everything when two properties are mentioned", () => {
    expect(matchProperty("Property ID 1000003 and 1000002", "", properties)).toEqual({ propertyId: null, matchedBy: "none" });
    expect(matchProperty("Wawel View Apartment, Kazimierz Studio", "", properties).propertyId).toBeNull();
  });
});

describe("matchProperty with several apartments in one Booking.com property", () => {
  // One Booking.com property (1962640) with two apartments as room types.
  const objectProperties: MatchableProperty[] = [
    ...properties,
    { id: "marynistyczny", name: "Marynistyczny Apartament 4-osobowy", bookingPropertyId: "1962640" },
    { id: "lesny", name: "Leśny", bookingPropertyId: "1962640", bookingRoomName: "Leśny Apartament 2-osobowy" },
  ];
  const matchIn = (fixture: string) => {
    const { subject, text } = email(fixture);
    return matchProperty(subject, text, objectProperties);
  };

  it("uses the room name to pick the apartment within the property", () => {
    expect(matchIn("multi-room-by-room-name")).toEqual({ propertyId: "marynistyczny", matchedBy: "name" });
  });

  it("uses the Booking.com room name when the app name is different", () => {
    const result = matchProperty("Nowa rezerwacja", "ID obiektu: 1962640\nPokój: Leśny Apartament 2-osobowy", objectProperties);
    expect(result).toEqual({ propertyId: "lesny", matchedBy: "name" });
  });

  it("syncs everything when the property is known but the room is not", () => {
    expect(matchIn("multi-room-no-room-name")).toEqual({ propertyId: null, matchedBy: "none" });
  });

  it("only considers apartments of the matched property", () => {
    // Old Town Loft is not part of property 1962640, so its name must not win.
    const result = matchProperty("ID obiektu 1962640", "Wspomniano: Old Town Loft", objectProperties);
    expect(result).toEqual({ propertyId: null, matchedBy: "none" });
  });
});
