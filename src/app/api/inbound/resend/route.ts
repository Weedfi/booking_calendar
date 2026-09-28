import { NextResponse, type NextRequest } from "next/server";
import { processEmail } from "@/lib/email-trigger/handler";
import { htmlToText } from "@/lib/email-trigger/html";
import { createEmailTriggerDeps } from "@/lib/email-trigger/server";
import { verifySvixSignature } from "@/lib/email-trigger/svix";

// The follow-up sync runs in after(), within this limit.
export const maxDuration = 60;

const MAX_BODY_BYTES = 256 * 1024;

type ReceivedEvent = { type?: string; data?: { email_id?: string } };
type ReceivedEmail = { from?: string; subject?: string; text?: string | null; html?: string | null; created_at?: string };

/**
 * Resend inbound: Booking.com notifications forwarded to the Resend receiving
 * address arrive here as a signed `email.received` webhook. The webhook only
 * carries metadata, so the body is fetched from the Resend API, then handled
 * exactly like /api/sync-trigger. Nothing from the email is stored except the
 * guest's name for the stay.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  if (!verifySvixSignature(raw, request.headers, process.env.RESEND_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: ReceivedEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  // Other event types may be subscribed to by mistake: acknowledge and ignore.
  if (event.type !== "email.received" || !event.data?.email_id) {
    return NextResponse.json({ ignored: event.type ?? "unknown event" }, { status: 202 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY is not set" }, { status: 500 });

  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(event.data.email_id)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  // A 5xx makes Resend retry the webhook later.
  if (!response.ok) return NextResponse.json({ error: `Resend API ${response.status}` }, { status: 502 });
  const email = (await response.json()) as ReceivedEmail;

  const result = await processEmail(
    {
      from: email.from ?? "",
      subject: email.subject ?? "",
      received_at: email.created_at,
      text: email.text?.trim() ? email.text : htmlToText(email.html ?? ""),
    },
    createEmailTriggerDeps(),
  );
  return NextResponse.json(result.body, { status: result.status });
}
