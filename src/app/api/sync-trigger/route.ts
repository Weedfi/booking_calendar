import { after, NextResponse, type NextRequest } from "next/server";
import { handleEmailTrigger } from "@/lib/email-trigger/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarize, syncNow } from "@/lib/sync/server";

// The follow-up sync runs in after(), within this limit.
export const maxDuration = 60;

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Near real-time sync: the Cloudflare Email Worker posts each forwarded
 * Booking.com notification here with `Authorization: Bearer <SYNC_TRIGGER_SECRET>`.
 * See handleEmailTrigger for the rules (sender check, matching, debounce).
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

  const db = createAdminClient();
  const result = await handleEmailTrigger(request.headers, body, {
    secret: process.env.SYNC_TRIGGER_SECRET,
    now: () => new Date(),
    listProperties: async () => {
      const { data, error } = await db.from("properties").select("id, name, booking_property_id, booking_room_name");
      if (error) throw error;
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        bookingPropertyId: p.booking_property_id,
        bookingRoomName: p.booking_room_name,
      }));
    },
    lastEmailSyncAt: async (propertyId) => {
      // A sync of everything (property_id null) covers every property too.
      let query = db.from("sync_events").select("started_at").eq("trigger", "email");
      query = propertyId ? query.or(`property_id.eq.${propertyId},property_id.is.null`) : query.is("property_id", null);
      const { data, error } = await query.order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? new Date(data.started_at) : null;
    },
    sync: async (propertyId, email) => summarize(await syncNow("email", propertyId ? [propertyId] : undefined, email)),
    runLater: (task) => after(task),
    saveGuest: async (propertyId, guest) => {
      const key = { property_id: propertyId, start_date: guest.checkIn, end_date: guest.checkOut };
      // A name entered by hand always wins over one read from an email.
      const { data: existing, error: readError } = await db.from("guest_stays").select("source").match(key).maybeSingle();
      if (readError) throw readError;
      if (existing?.source === "manual") return;
      const { error } = await db
        .from("guest_stays")
        .upsert({ ...key, guest_name: guest.guestName, source: "email" }, { onConflict: "property_id,start_date,end_date" });
      if (error) throw error;
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  return NextResponse.json(result.body, { status: result.status });
}
