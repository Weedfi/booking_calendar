import type { ChannelSource } from "@/lib/calendar/tape-chart";

export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES: ChannelSource[] = ["booking", "airbnb", "other"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export type PropertyInput = {
  name: string;
  address: string | null;
  owner_id: string | null;
  color: string;
  booking_property_id: string | null;
};

export function parseProperty(form: FormData): Parsed<PropertyInput> {
  const errors: FieldErrors = {};
  const name = text(form, "name");
  const address = text(form, "address");
  const owner = text(form, "owner_id");
  const color = text(form, "color").toLowerCase() || "#3b82f6";
  const bookingId = text(form, "booking_property_id");

  if (!name) errors.name = "Name is required.";
  else if (name.length > 100) errors.name = "Keep the name under 100 characters.";
  if (address.length > 200) errors.address = "Keep the address under 200 characters.";
  if (owner && !UUID.test(owner)) errors.owner_id = "Choose an owner from the list.";
  if (!/^#[0-9a-f]{6}$/.test(color)) errors.color = "Use a hex color like #3b82f6.";
  if (bookingId && !/^\d{1,20}$/.test(bookingId)) errors.booking_property_id = "The Booking.com property ID is a number.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      address: address || null,
      owner_id: owner || null,
      color,
      booking_property_id: bookingId || null,
    },
  };
}

export type ChannelInput = { property_id: string; source: ChannelSource; ical_url: string };

export function parseChannel(form: FormData, { allowHttp = false } = {}): Parsed<ChannelInput> {
  const errors: FieldErrors = {};
  const propertyId = text(form, "property_id");
  const source = text(form, "source") as ChannelSource;
  const url = text(form, "ical_url");

  if (!UUID.test(propertyId)) errors.property_id = "Unknown property.";
  if (!SOURCES.includes(source)) errors.source = "Choose a channel.";
  const urlError = icalUrlError(url, allowHttp);
  if (urlError) errors.ical_url = urlError;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { property_id: propertyId, source, ical_url: url } };
}

function icalUrlError(url: string, allowHttp: boolean): string | null {
  if (!url) return "Paste the iCal export link.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "That is not a valid link.";
  }
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    return "The link must start with https://.";
  }
  if (url.length > 2000) return "That link is too long.";
  return null;
}

export type InviteInput = { email: string; full_name: string };

export function parseInvite(form: FormData): Parsed<InviteInput> {
  const errors: FieldErrors = {};
  const email = text(form, "email").toLowerCase();
  const fullName = text(form, "full_name");

  if (!EMAIL.test(email)) errors.email = "Enter a valid email address.";
  if (!fullName) errors.full_name = "Name is required.";
  else if (fullName.length > 100) errors.full_name = "Keep the name under 100 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, full_name: fullName } };
}

/**
 * Shows enough of an iCal URL to tell feeds apart, without revealing the
 * secret token in it: "ical.booking.com/…a1b2".
 */
export function maskUrl(url: string): string {
  try {
    const { host, pathname, search } = new URL(url);
    const tail = (pathname + search).replace(/\.ics$/i, "").slice(-4);
    return `${host}/…${tail}`;
  } catch {
    return "…";
  }
}
