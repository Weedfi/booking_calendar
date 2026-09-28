import { createHmac, timingSafeEqual } from "node:crypto";

/** Accept signatures up to five minutes old (Svix's recommendation), to block replays. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies a webhook signed with Svix, which Resend uses:
 * signature = base64(HMAC-SHA256(secret, "{svix-id}.{svix-timestamp}.{raw body}")),
 * where the secret is the base64 part of "whsec_...". The svix-signature
 * header may list several "v1,<signature>" entries (during secret rotation).
 * Fails closed when the secret or any header is missing.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!secret) return false;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now.getTime() / 1000 - sentAt) > TOLERANCE_SECONDS) return false;

  let key: Buffer;
  try {
    key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatures.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
