/**
 * Cloudflare Email Worker: receives Booking.com notifications forwarded by
 * the manager's mailbox (via Cloudflare Email Routing) and pings the app's
 * /api/sync-trigger. It sends only what the app needs to find the property;
 * the app does not store any of it.
 */
import PostalMime from "postal-mime";

export interface Env {
  /** e.g. https://your-app.vercel.app/api/sync-trigger */
  SYNC_TRIGGER_URL: string;
  /** Same value as SYNC_TRIGGER_SECRET in the app. Set with `wrangler secret put`. */
  SYNC_TRIGGER_SECRET: string;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const email = await PostalMime.parse(message.raw);
    // The header From survives mailbox forwarding; the envelope sender does not.
    const from = email.from?.address ? `${email.from.name ?? ""} <${email.from.address}>`.trim() : message.from;

    const response = await fetch(env.SYNC_TRIGGER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.SYNC_TRIGGER_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        subject: email.subject ?? "",
        received_at: new Date().toISOString(),
        text: email.text ?? "",
      }),
    });

    // Never reject the message: a bounce would go back to the manager's mailbox.
    // The 5-minute cron sync still covers anything missed here.
    console.log(`sync-trigger responded ${response.status}`);
  },
};
