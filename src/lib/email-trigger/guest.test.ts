import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDate } from "@/lib/parse-date";
import { extractGuest } from "./guest";

const email = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../tests/fixtures/emails/${name}.json`, import.meta.url), "utf8")) as {
    subject: string;
    text: string;
  };

describe("extractGuest with fake Booking.com emails", () => {
  it("reads the guest and dates from an English notification", () => {
    const { subject, text } = email("new-booking-with-id");
    expect(extractGuest(subject, text)).toEqual({ guestName: "Jane Example", checkIn: "2026-10-09", checkOut: "2026-10-12" });
  });

  it("reads a Polish notification with weekday-prefixed dates", () => {
    const text = "Imię i nazwisko gościa: Jan Kowalski\nZameldowanie: pt., 16 paź 2026\nWymeldowanie: pn., 19 paź 2026";
    expect(extractGuest("Nowa rezerwacja", text)).toEqual({ guestName: "Jan Kowalski", checkIn: "2026-10-16", checkOut: "2026-10-19" });
  });

  it("prefers the guest's name over the booker's", () => {
    const text = "Zarezerwowane przez: Firma Sp. z o.o.\nGość: Anna Nowak\nPrzyjazd: 2026-10-01\nWyjazd: 2026-10-03";
    expect(extractGuest("", text)?.guestName).toBe("Anna Nowak");
  });

  it("returns null when something is missing, so the sync is unaffected", () => {
    expect(extractGuest("", "Zameldowanie: 2026-10-01\nWymeldowanie: 2026-10-03")).toBeNull();
    expect(extractGuest("", "Gość: Anna Nowak\nZameldowanie: 2026-10-01")).toBeNull();
    const { subject, text } = email("unknown-format");
    expect(extractGuest(subject, text)).toBeNull();
  });

  it("rejects values that are not names", () => {
    expect(extractGuest("", "Gość: jan@example.com\nZameldowanie: 2026-10-01\nWymeldowanie: 2026-10-03")).toBeNull();
    expect(extractGuest("", "Gość: 4012345678\nZameldowanie: 2026-10-01\nWymeldowanie: 2026-10-03")).toBeNull();
  });
});

describe("parseDate with email-style dates", () => {
  it.each([
    ["pt., 16 paź 2026", "2026-10-16"],
    ["16 października 2026", "2026-10-16"],
    ["Friday, 16 October 2026", "2026-10-16"],
    ["Fri 9 Oct 2031", "2031-10-09"],
    ["Sep 19, 2026", "2026-09-19"],
  ])("%s -> %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });
});

describe("extractGuest from an HTML email laid out as a table", () => {
  it("pairs labels and values from separate table cells", async () => {
    const { htmlToText } = await import("./html");
    const html = `<html><head><style>td{color:red}</style></head><body>
      <h1>Nowa rezerwacja!</h1>
      <table>
        <tr><td>Imię i nazwisko gościa:</td><td>Jan&nbsp;Kowalski</td></tr>
        <tr><td>Zameldowanie</td><td>pt., 16 paź 2026</td></tr>
        <tr><td>Wymeldowanie</td><td>pn., 19 paź 2026</td></tr>
        <tr><td>Pokój</td><td>Marynistyczny Apartament 4-osobowy</td></tr>
      </table></body></html>`;
    const text = htmlToText(html);
    expect(text).not.toContain("color:red");
    expect(extractGuest("Nowa rezerwacja", text)).toEqual({ guestName: "Jan Kowalski", checkIn: "2026-10-16", checkOut: "2026-10-19" });
  });
});
