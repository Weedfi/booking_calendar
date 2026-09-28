import { NextResponse, type NextRequest } from "next/server";
import { handleEmailTrigger } from "@/lib/email-trigger/handler";
import { createEmailTriggerDeps } from "@/lib/email-trigger/server";

// The follow-up sync runs in after(), within this limit.
export const maxDuration = 60;

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Near real-time sync: a Cloudflare Email Worker (or any forwarder) posts each
 * Booking.com notification here with `Authorization: Bearer <SYNC_TRIGGER_SECRET>`.
 * See processEmail for the rules (sender check, matching, debounce, guest name).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // Left as null; the handler answers 400 after checking the secret.
  }

  const result = await handleEmailTrigger(request.headers, body, createEmailTriggerDeps());
  return NextResponse.json(result.body, { status: result.status });
}
