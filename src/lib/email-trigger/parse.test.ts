import { describe, expect, it } from "vitest";
import { isBookingSender, parsePayload, senderAddress } from "./parse";

const NOW = new Date("2026-09-25T10:00:00Z");

describe("parsePayload", () => {
  it("reads a complete payload", () => {
    expect(
      parsePayload({ from: "noreply@booking.com", subject: "Hi", text: "Body", received_at: "2026-09-25T09:59:00Z" }, NOW),
    ).toEqual({ from: "noreply@booking.com", subject: "Hi", text: "Body", receivedAt: new Date("2026-09-25T09:59:00Z") });
  });

  it("defaults missing optional fields", () => {
    expect(parsePayload({ from: "noreply@booking.com" }, NOW)).toEqual({
      from: "noreply@booking.com",
      subject: "",
      text: "",
      receivedAt: NOW,
    });
  });

  it("truncates very long bodies", () => {
    expect(parsePayload({ from: "a@booking.com", text: "x".repeat(80_000) }, NOW)?.text).toHaveLength(50_000);
  });

  it.each([
    null,
    "string",
    {},
    { from: 42 },
    { from: "a@booking.com", subject: ["x"] },
    { from: "a@booking.com", received_at: "not a date" },
  ])("rejects %j", (input) => {
    expect(parsePayload(input, NOW)).toBeNull();
  });
});

describe("senderAddress", () => {
  it("extracts the address from a display name", () => {
    expect(senderAddress('"Booking.com" <NoReply@Booking.com>')).toBe("noreply@booking.com");
    expect(senderAddress("noreply@booking.com")).toBe("noreply@booking.com");
    expect(senderAddress("Booking.com")).toBeNull();
  });
});

describe("isBookingSender", () => {
  it.each(["noreply@booking.com", "Booking <reservations@mchat.booking.com>"])("accepts %s", (from) => {
    expect(isBookingSender(from)).toBe(true);
  });

  it.each([
    "noreply@booking.com.evil.example",
    "noreply@notbooking.com",
    "Booking.com <noreply@evil.example>",
    "noreply@booking.com <attacker@evil.example>",
    "",
  ])("rejects %s", (from) => {
    expect(isBookingSender(from)).toBe(false);
  });
});
