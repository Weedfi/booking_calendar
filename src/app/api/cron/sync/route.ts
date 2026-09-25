import { NextResponse, type NextRequest } from "next/server";
import { hasBearerSecret } from "@/lib/secrets";
import { summarize, syncNow } from "@/lib/sync/server";

// Feeds are fetched in parallel with a 15 s timeout each; leave headroom.
export const maxDuration = 60;

/**
 * Fallback sync of every channel, called every few minutes by the GitHub
 * Actions workflow (or Vercel Cron) with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  if (!hasBearerSecret(request.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = summarize(await syncNow("cron"));
  // 200 even if some channels failed: the run itself worked, and failures are
  // recorded per channel. A 5xx would only make the scheduler retry.
  return NextResponse.json(summary);
}
