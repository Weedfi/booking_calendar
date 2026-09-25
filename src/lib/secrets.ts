import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison. Both sides are hashed first so the
 * comparison takes the same time whatever the lengths are.
 */
export function safeEqual(a: string, b: string): boolean {
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}

/**
 * Checks `Authorization: Bearer <secret>` (the header Vercel Cron and our
 * GitHub Actions workflow send). Fails closed when the secret is not configured.
 */
export function hasBearerSecret(headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match !== null && safeEqual(match[1], secret);
}
