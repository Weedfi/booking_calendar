import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/secrets";

/**
 * Invitation links that never expire. Supabase's own email links last at
 * most a day, so the invitation email links to /invite with this token
 * instead: the email address plus an HMAC of it. It cannot be forged without
 * the server secret, and it only works until the invitation is accepted
 * (the page checks that the address has not been confirmed yet).
 */

const VERSION = "v1";

function signature(email: string, secret: string): string {
  // A key derived for this purpose only, so the token never reveals anything
  // about the secret it comes from.
  const key = createHmac("sha256", secret).update(`invite-link-${VERSION}`).digest();
  return createHmac("sha256", key).update(email.toLowerCase()).digest("base64url");
}

export function createInviteToken(email: string, secret: string): string {
  const address = Buffer.from(email.toLowerCase()).toString("base64url");
  return `${VERSION}.${address}.${signature(email, secret)}`;
}

/** The email address an invitation token was made for, or null if it is not genuine. */
export function readInviteToken(token: string, secret: string): string | null {
  const [version, address, sig] = token.split(".");
  if (version !== VERSION || !address || !sig) return null;
  const email = Buffer.from(address, "base64url").toString();
  if (!email.includes("@")) return null;
  return safeEqual(sig, signature(email, secret)) ? email : null;
}

/** The secret the tokens are signed with: the Supabase secret key, never sent to the browser. */
export function inviteSecret(): string {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY must be set");
  return secret;
}
