import type { DateKey } from "@/lib/dates";

/** A guest name for an apartment and stay dates (table guest_stays). */
export type GuestStay = {
  propertyId: string;
  startDate: DateKey;
  endDate: DateKey;
  guestName: string;
  source: "manual" | "email";
};

type Stay = { propertyId: string; startDate: DateKey; endDate: DateKey };

/**
 * Names of the guests staying within a reservation. Usually one, but
 * Booking.com may merge back-to-back stays of one room into one block, so a
 * block can hold several guests, listed in date order.
 */
export function guestsFor(reservation: Stay, guests: GuestStay[]): string[] {
  return guests
    .filter(
      (g) =>
        g.propertyId === reservation.propertyId &&
        g.startDate >= reservation.startDate &&
        g.endDate <= reservation.endDate,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((g) => g.guestName)
    // A changed booking can leave the same name under old and new dates.
    .filter((name, i, all) => all.indexOf(name) === i);
}

/** Adds a `guests` list to each reservation. */
export function withGuests<T extends Stay>(reservations: T[], guests: GuestStay[]): (T & { guests: string[] })[] {
  return reservations.map((r) => ({ ...r, guests: guestsFor(r, guests) }));
}
