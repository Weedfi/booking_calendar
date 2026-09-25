import { describe, expect, it } from "vitest";
import { maskUrl, parseChannel, parseInvite, parseProperty } from "./forms";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const PROPERTY_ID = "c0000000-0000-4000-8000-000000000001";
const OWNER_ID = "b0000000-0000-4000-8000-000000000001";

describe("parseProperty", () => {
  it("accepts a complete property and normalizes empty fields to null", () => {
    expect(parseProperty(form({ name: "  Loft ", address: "", owner_id: OWNER_ID, color: "#EF4444", booking_property_id: "1000001" }))).toEqual({
      ok: true,
      value: { name: "Loft", address: null, owner_id: OWNER_ID, color: "#ef4444", booking_property_id: "1000001" },
    });
  });

  it("allows a property without owner or Booking.com ID", () => {
    const result = parseProperty(form({ name: "Loft" }));
    expect(result).toMatchObject({ ok: true, value: { owner_id: null, booking_property_id: null, color: "#3b82f6" } });
  });

  it("reports every invalid field", () => {
    const result = parseProperty(form({ name: "", owner_id: "x", color: "red", booking_property_id: "12a" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["booking_property_id", "color", "name", "owner_id"]);
  });
});

describe("parseChannel", () => {
  const valid = { property_id: PROPERTY_ID, source: "booking", ical_url: "https://ical.booking.com/v1/export?t=abc123" };

  it("accepts an https feed", () => {
    expect(parseChannel(form(valid))).toEqual({ ok: true, value: valid });
  });

  it("rejects non-https links unless explicitly allowed (local development)", () => {
    const http = form({ ...valid, ical_url: "http://127.0.0.1:9999/feed.ics" });
    expect(parseChannel(http)).toMatchObject({ ok: false, errors: { ical_url: "The link must start with https://." } });
    expect(parseChannel(http, { allowHttp: true }).ok).toBe(true);
  });

  it("rejects other schemes, garbage and unknown sources", () => {
    expect(parseChannel(form({ ...valid, ical_url: "javascript:alert(1)" })).ok).toBe(false);
    expect(parseChannel(form({ ...valid, ical_url: "not a url" })).ok).toBe(false);
    expect(parseChannel(form({ ...valid, source: "vrbo" })).ok).toBe(false);
  });
});

describe("parseInvite", () => {
  it("normalizes the email", () => {
    expect(parseInvite(form({ email: " Anna@Example.com ", full_name: "Anna" }))).toEqual({
      ok: true,
      value: { email: "anna@example.com", full_name: "Anna" },
    });
  });

  it("requires a valid email and a name", () => {
    expect(parseInvite(form({ email: "anna", full_name: "" }))).toMatchObject({ ok: false });
  });
});

describe("maskUrl", () => {
  it("keeps the host and the last characters only", () => {
    expect(maskUrl("https://ical.booking.com/v1/export?t=0f3c9a1b-secret-a1b2")).toBe("ical.booking.com/…a1b2");
    expect(maskUrl("https://www.airbnb.com/calendar/ical/12345.ics?s=deadbeef9f8e")).toBe("www.airbnb.com/…9f8e");
  });

  it("never throws", () => {
    expect(maskUrl("garbage")).toBe("…");
  });
});
