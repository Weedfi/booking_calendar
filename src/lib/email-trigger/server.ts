import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarize, syncNow } from "@/lib/sync/server";
import type { EmailTriggerDeps } from "./handler";

/**
 * Real dependencies of the email trigger (database, sync, after()). Shared by
 * /api/sync-trigger (Cloudflare Worker, bearer secret) and
 * /api/inbound/resend (Resend inbound, signed webhook).
 */
export function createEmailTriggerDeps(): EmailTriggerDeps {
  const db = createAdminClient();
  return {
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
  };
}
