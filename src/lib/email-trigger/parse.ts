/**
 * Input handling for the email trigger. The email is only a hint that
 * something changed; nothing parsed here is ever stored.
 */

export type EmailPayload = {
  subject: string;
  from: string;
  receivedAt: Date;
  text: string;
};

/** Enough for any notification email; the body is only scanned for a property. */
const MAX_TEXT_LENGTH = 50_000;

export function parsePayload(input: unknown, now: Date): EmailPayload | null {
  if (!input || typeof input !== "object") return null;
  const { subject, from, received_at: receivedAt, text } = input as Record<string, unknown>;

  if (typeof from !== "string" || from.length > 500) return null;
  if (subject !== undefined && (typeof subject !== "string" || subject.length > 1000)) return null;
  if (text !== undefined && typeof text !== "string") return null;

  let received = now;
  if (typeof receivedAt === "string") {
    const parsed = new Date(receivedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    received = parsed;
  }

  return {
    subject: subject ?? "",
    from,
    receivedAt: received,
    text: (text ?? "").slice(0, MAX_TEXT_LENGTH),
  };
}

/** The address in `"Booking.com" <noreply@booking.com>` or a bare address. */
export function senderAddress(from: string): string | null {
  const match = /<([^<>\s]+@[^<>\s]+)>/.exec(from) ?? /^\s*([^\s<>]+@[^\s<>]+)\s*$/.exec(from);
  return match ? match[1].toLowerCase() : null;
}

/**
 * True for booking.com and its subdomains only. Look-alikes such as
 * booking.com.evil.example or notbooking.com are rejected.
 */
export function isBookingSender(from: string): boolean {
  const address = senderAddress(from);
  if (!address) return false;
  const domain = address.slice(address.lastIndexOf("@") + 1);
  return domain === "booking.com" || domain.endsWith(".booking.com");
}
