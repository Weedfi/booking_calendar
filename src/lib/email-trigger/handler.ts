import { hasBearerSecret } from "@/lib/secrets";
import type { EmailTriggerInfo } from "@/lib/sync/store";
import { extractGuest, type EmailGuest } from "./guest";
import { matchProperty, type MatchableProperty } from "./match";
import { isBookingSender, parsePayload } from "./parse";

/** Booking may send several emails for one change; one sync covers them. */
export const DEBOUNCE_MS = 20_000;

/**
 * Booking can update the iCal feed a little after the email. A second sync
 * runs after this delay. It has to fit in the function's time limit (60 s on
 * the Vercel free plan); the 5-minute cron catches anything later still.
 */
export const FOLLOW_UP_DELAY_MS = 45_000;

export type SyncSummary = { ok: boolean; channels: number; failed: number; upserted: number; cancelled: number };

export type EmailTriggerDeps = {
  secret: string | undefined;
  now: () => Date;
  listProperties: () => Promise<MatchableProperty[]>;
  /** Start of the latest email-triggered sync covering this property (null = all). */
  lastEmailSyncAt: (propertyId: string | null) => Promise<Date | null>;
  sync: (propertyId: string | null, email: EmailTriggerInfo) => Promise<SyncSummary>;
  /** Runs work after the response is sent (Next.js `after`). */
  runLater: (task: () => Promise<void>) => void;
  /** Stores the guest's name for the stay; must never overwrite a name entered by hand. */
  saveGuest?: (propertyId: string, guest: EmailGuest) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
};

export type EmailTriggerResponse = { status: number; body: Record<string, unknown> };

/**
 * Handles one forwarded notification email. The email tells us *that*
 * something changed; the iCal feed stays the single source of truth for
 * dates. The only thing kept from the email is the guest's name for the stay
 * (a product decision); the email itself is neither stored nor logged.
 */
export async function handleEmailTrigger(
  headers: Headers,
  body: unknown,
  deps: EmailTriggerDeps,
): Promise<EmailTriggerResponse> {
  if (!hasBearerSecret(headers, deps.secret)) return { status: 401, body: { error: "Unauthorized" } };
  return processEmail(body, deps);
}

/**
 * Everything after authentication; also used by the Resend inbound webhook,
 * which authenticates with its own signature.
 */
export async function processEmail(body: unknown, deps: EmailTriggerDeps): Promise<EmailTriggerResponse> {
  const now = deps.now();
  const email = parsePayload(body, now);
  if (!email) return { status: 400, body: { error: "Invalid payload" } };

  // Not an error: the mailbox may forward other mail too. Nothing happens.
  if (!isBookingSender(email.from)) return { status: 202, body: { ignored: "sender is not Booking.com" } };

  const { propertyId, matchedBy } = matchProperty(email.subject, email.text, await deps.listProperties());
  const info: EmailTriggerInfo = { receivedAt: email.receivedAt, matchedBy };

  // The guest's name is stored even when the sync is debounced: a second email
  // may carry new dates. Only the name and dates are kept, never the email.
  const guest = propertyId && deps.saveGuest ? extractGuest(email.subject, email.text) : null;
  if (propertyId && guest) await deps.saveGuest!(propertyId, guest);
  const guestSaved = Boolean(propertyId && guest);

  const last = await deps.lastEmailSyncAt(propertyId);
  if (last && now.getTime() - last.getTime() < DEBOUNCE_MS) {
    // A sync for this change just ran, and its follow-up sync is still to come.
    return { status: 202, body: { debounced: true, propertyId, matchedBy, guestSaved } };
  }

  const summary = await deps.sync(propertyId, info);

  deps.runLater(async () => {
    await deps.sleep(FOLLOW_UP_DELAY_MS);
    await deps.sync(propertyId, info);
  });

  return { status: 200, body: { propertyId, matchedBy, guestSaved, followUpInSeconds: FOLLOW_UP_DELAY_MS / 1000, ...summary } };
}
