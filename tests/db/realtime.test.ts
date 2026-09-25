import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serviceClient, signInAs } from "./helpers";

/**
 * Realtime must respect RLS: an owner gets live changes for their own
 * properties and nothing about anyone else's.
 */

const runId = Date.now().toString(36);
const service = serviceClient();
const ids = { ownerA: "", ownerB: "", property: "", channel: "" };
const received: Record<"a" | "b", unknown[]> = { a: [], b: [] };
const subscriptions: { client: SupabaseClient; channel: RealtimeChannel }[] = [];

async function subscribe(client: SupabaseClient, into: unknown[]) {
  const channel = client
    .channel(`test-${runId}-${subscriptions.length}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, (payload) => {
      into.push(payload.new);
    });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime was not ready in 20 s")), 20_000);
    // SUBSCRIBED arrives before change streaming works; a change made in
    // between is lost. Wait for the server's "Subscribed to PostgreSQL".
    channel.on("system", {}, (payload: { extension: string; status: string }) => {
      if (payload.extension === "postgres_changes" && payload.status === "ok") {
        clearTimeout(timeout);
        resolve();
      }
    });
    channel.subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        reject(error ?? new Error(status));
      }
    });
  });
  subscriptions.push({ client, channel });
}

const waitFor = async (check: () => boolean, ms: number) => {
  const until = Date.now() + ms;
  while (!check() && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
};

beforeAll(async () => {
  for (const key of ["ownerA", "ownerB"] as const) {
    const { data, error } = await service.auth.admin.createUser({ email: `rt-${key}-${runId}@test.local`, email_confirm: true });
    if (error) throw error;
    ids[key] = data.user.id;
  }
  const { data: property, error } = await service
    .from("properties")
    .insert({ name: `rt-${runId}`, owner_id: ids.ownerA })
    .select("id")
    .single();
  if (error) throw error;
  ids.property = property.id;
  const { data: channel, error: channelError } = await service
    .from("channels")
    .insert({ property_id: ids.property, source: "booking", ical_url: `https://example.com/${runId}.ics` })
    .select("id")
    .single();
  if (channelError) throw channelError;
  ids.channel = channel.id;

  await subscribe(await signInAs(`rt-ownerA-${runId}@test.local`), received.a);
  await subscribe(await signInAs(`rt-ownerB-${runId}@test.local`), received.b);
});

afterAll(async () => {
  for (const { client, channel } of subscriptions) await client.removeChannel(channel);
  if (ids.property) await service.from("properties").delete().eq("id", ids.property);
  for (const id of [ids.ownerA, ids.ownerB].filter(Boolean)) await service.auth.admin.deleteUser(id);
});

describe("Realtime with RLS", () => {
  it("delivers a new reservation to its owner only", async () => {
    const { error } = await service.from("reservations").insert({
      property_id: ids.property,
      channel_id: ids.channel,
      source: "booking",
      external_uid: `${runId}@test`,
      start_date: "2030-03-01",
      end_date: "2030-03-04",
    });
    if (error) throw error;

    await waitFor(() => received.a.length > 0, 10_000);
    // Give a leak to owner B time to show up before asserting it did not.
    await new Promise((r) => setTimeout(r, 1500));

    expect(received.a).toEqual([expect.objectContaining({ property_id: ids.property, start_date: "2030-03-01" })]);
    expect(received.b).toEqual([]);
  });
});
