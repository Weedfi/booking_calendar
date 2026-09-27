import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { FeedFetchError } from "@/lib/sync/fetch-ical";
import { runSync } from "@/lib/sync/run-sync";
import { createSupabaseSyncStore } from "@/lib/sync/supabase-store";
import { serviceClient } from "./helpers";

/**
 * Runs the real sync against the local database, with feeds served from
 * fixtures instead of the network. Scoped to its own test property.
 */

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/ical/${name}`, import.meta.url), "utf8");

const db = serviceClient() as SupabaseClient<Database>;
const store = createSupabaseSyncStore(db);
const runId = Date.now().toString(36);
const urls = {
  booking: `https://feeds.test/${runId}/booking.ics`,
  airbnb: `https://feeds.test/${runId}/airbnb.ics`,
};
const feeds: Record<string, string | Error> = {};
const fetchIcal = async (url: string) => {
  const feed = feeds[url];
  if (feed instanceof Error) throw feed;
  if (feed === undefined) throw new FeedFetchError("HTTP 404 Not Found");
  return feed;
};
const NOW = new Date("2031-01-05T09:00:00Z");
const sync = () => runSync({ trigger: "manual", propertyIds: [propertyId] }, { store, fetchIcal, now: () => NOW });

let propertyId = "";
let bookingChannelId = "";
let airbnbChannelId = "";

async function reservations(channelId: string) {
  const { data, error } = await db
    .from("reservations")
    .select("external_uid, start_date, end_date, status, updated_at, property_id, source")
    .eq("channel_id", channelId)
    .order("start_date");
  if (error) throw error;
  return data;
}

async function channel(id: string) {
  const { data, error } = await db
    .from("channels")
    .select("last_synced_at, last_sync_error")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  const { data: property, error } = await db
    .from("properties")
    .insert({ name: `sync-test-${runId}` })
    .select("id")
    .single();
  if (error) throw error;
  propertyId = property.id;

  const { data: channels, error: channelError } = await db
    .from("channels")
    .insert([
      { property_id: propertyId, source: "booking", ical_url: urls.booking },
      { property_id: propertyId, source: "airbnb", ical_url: urls.airbnb },
    ])
    .select("id, source");
  if (channelError) throw channelError;
  bookingChannelId = channels.find((c) => c.source === "booking")!.id;
  airbnbChannelId = channels.find((c) => c.source === "airbnb")!.id;
});

afterAll(async () => {
  if (!propertyId) return;
  await db.from("sync_events").delete().eq("property_id", propertyId);
  await db.from("properties").delete().eq("id", propertyId);
});

describe("sync against Supabase", () => {
  it("imports both channels of a property", async () => {
    feeds[urls.booking] = fixture("booking.ics");
    feeds[urls.airbnb] = fixture("airbnb.ics");

    const result = await sync();

    expect(result.ok).toBe(true);
    const rows = await reservations(bookingChannelId);
    expect(rows.map((r) => [r.external_uid, r.start_date, r.end_date, r.status])).toEqual([
      ["fake-booking-0001@booking.com", "2031-01-10", "2031-01-13", "active"],
      ["fake-booking-0002@booking.com", "2031-01-13", "2031-01-20", "active"],
      ["fake-booking-0003@booking.com", "2031-01-31", "2031-02-02", "active"],
    ]);
    expect(rows.every((r) => r.property_id === propertyId && r.source === "booking")).toBe(true);
    expect(await reservations(airbnbChannelId)).toHaveLength(2);
    expect((await channel(bookingChannelId)).last_synced_at).not.toBeNull();
  });

  it("leaves rows untouched when nothing changed", async () => {
    const before = await reservations(bookingChannelId);
    await sync();
    expect(await reservations(bookingChannelId)).toEqual(before);
  });

  it("cancels a booking that left the feed", async () => {
    feeds[urls.booking] = fixture("booking.ics").replace(
      /BEGIN:VEVENT\nDTSTAMP:20310101T090000Z\nDTSTART;VALUE=DATE:20310110[\s\S]*?END:VEVENT\n/,
      "",
    );
    await sync();

    const statuses = (await reservations(bookingChannelId)).map((r) => r.status);
    expect(statuses).toEqual(["cancelled", "active", "active"]);
  });

  it("records a failing channel without affecting the other one", async () => {
    feeds[urls.airbnb] = new FeedFetchError("HTTP 503 Service Unavailable");
    feeds[urls.booking] = fixture("booking.ics"); // the cancelled booking is back

    const result = await sync();

    expect(result.ok).toBe(false);
    expect((await channel(airbnbChannelId)).last_sync_error).toBe("HTTP 503 Service Unavailable");
    expect((await channel(bookingChannelId)).last_sync_error).toBeNull();
    expect((await reservations(bookingChannelId)).map((r) => r.status)).toEqual(["active", "active", "active"]);

    const { data: event } = await db
      .from("sync_events")
      .select("trigger, ok, error, finished_at")
      .eq("property_id", propertyId)
      .order("id", { ascending: false })
      .limit(1)
      .single();
    expect(event).toMatchObject({
      trigger: "manual",
      ok: false,
      error: "Błąd w 1 z 2 kanałów: HTTP 503 Service Unavailable",
    });
    expect(event?.finished_at).not.toBeNull();
  });
});
