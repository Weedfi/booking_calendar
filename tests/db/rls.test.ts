import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, serviceClient, signInAs } from "./helpers";

/**
 * Proves that Row Level Security, not the UI, isolates owners from each other.
 * Creates its own users and data (independent of seed.sql) and cleans up after.
 */

const runId = Date.now().toString(36);
const emails = {
  ownerA: `rls-owner-a-${runId}@test.local`,
  ownerB: `rls-owner-b-${runId}@test.local`,
  admin: `rls-admin-${runId}@test.local`,
};

const service = serviceClient();
const ids = {
  ownerA: "",
  ownerB: "",
  admin: "",
  propA: "",
  propB: "",
  resA: "",
  resB: "",
};
let asOwnerA: SupabaseClient;
let asAdmin: SupabaseClient;

async function createUser(email: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

async function createPropertyWithReservation(ownerId: string, name: string) {
  const { data: property, error: propertyError } = await service
    .from("properties")
    .insert({ name, owner_id: ownerId })
    .select("id")
    .single();
  if (propertyError) throw propertyError;

  const { data: channel, error: channelError } = await service
    .from("channels")
    .insert({
      property_id: property.id,
      source: "booking",
      ical_url: `https://example.com/secret/${runId}/${name}.ics`,
    })
    .select("id")
    .single();
  if (channelError) throw channelError;

  const { data: reservation, error: reservationError } = await service
    .from("reservations")
    .insert({
      property_id: property.id,
      channel_id: channel.id,
      source: "booking",
      external_uid: `${runId}-${name}@test`,
      start_date: "2030-01-10",
      end_date: "2030-01-13",
      summary: "CLOSED - Not available",
    })
    .select("id")
    .single();
  if (reservationError) throw reservationError;

  return { propertyId: property.id as string, reservationId: reservation.id as string };
}

beforeAll(async () => {
  ids.ownerA = await createUser(emails.ownerA);
  ids.ownerB = await createUser(emails.ownerB);
  ids.admin = await createUser(emails.admin);

  const { error } = await service.from("profiles").update({ role: "admin" }).eq("id", ids.admin);
  if (error) throw error;

  const a = await createPropertyWithReservation(ids.ownerA, `prop-a-${runId}`);
  const b = await createPropertyWithReservation(ids.ownerB, `prop-b-${runId}`);
  ids.propA = a.propertyId;
  ids.resA = a.reservationId;
  ids.propB = b.propertyId;
  ids.resB = b.reservationId;

  asOwnerA = await signInAs(emails.ownerA);
  asAdmin = await signInAs(emails.admin);
});

afterAll(async () => {
  // Channels and reservations cascade from properties; profiles cascade from users.
  await service.from("properties").delete().in("id", [ids.propA, ids.propB].filter(Boolean));
  for (const id of [ids.ownerA, ids.ownerB, ids.admin].filter(Boolean)) {
    await service.auth.admin.deleteUser(id);
  }
});

describe("owner", () => {
  it("sees only their own properties", async () => {
    const { data, error } = await asOwnerA.from("properties").select("id");
    expect(error).toBeNull();
    expect(data?.map((p) => p.id)).toEqual([ids.propA]);
  });

  it("cannot read another owner's property by id", async () => {
    const { data, error } = await asOwnerA.from("properties").select("id").eq("id", ids.propB);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("sees only reservations of their own properties", async () => {
    const { data, error } = await asOwnerA.from("reservations").select("id, property_id");
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([ids.resA]);
  });

  it("cannot read another owner's reservation by id", async () => {
    const { data } = await asOwnerA.from("reservations").select("id").eq("id", ids.resB);
    expect(data).toEqual([]);
  });

  it("cannot read any channels, including their own (iCal URLs are secret)", async () => {
    const { data, error } = await asOwnerA.from("channels").select("id, ical_url");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot read sync events", async () => {
    const { data } = await asOwnerA.from("sync_events").select("id");
    expect(data).toEqual([]);
  });

  it("sees only their own profile", async () => {
    const { data } = await asOwnerA.from("profiles").select("id");
    expect(data?.map((p) => p.id)).toEqual([ids.ownerA]);
  });

  it("cannot promote themselves to admin", async () => {
    await asOwnerA.from("profiles").update({ role: "admin" }).eq("id", ids.ownerA);

    const { data } = await service.from("profiles").select("role").eq("id", ids.ownerA).single();
    expect(data?.role).toBe("owner");
  });

  it("cannot modify another owner's property", async () => {
    await asOwnerA.from("properties").update({ name: "hacked" }).eq("id", ids.propB);

    const { data } = await service.from("properties").select("name").eq("id", ids.propB).single();
    expect(data?.name).toBe(`prop-b-${runId}`);
  });

  it("cannot reassign another owner's property to themselves", async () => {
    await asOwnerA.from("properties").update({ owner_id: ids.ownerA }).eq("id", ids.propB);

    const { data } = await service.from("properties").select("owner_id").eq("id", ids.propB).single();
    expect(data?.owner_id).toBe(ids.ownerB);
  });

  it("cannot insert reservations, even for their own property", async () => {
    const { data: channel } = await service
      .from("channels")
      .select("id")
      .eq("property_id", ids.propA)
      .single();

    const { error } = await asOwnerA.from("reservations").insert({
      property_id: ids.propA,
      channel_id: channel?.id,
      source: "booking",
      external_uid: `${runId}-forged@test`,
      start_date: "2030-02-01",
      end_date: "2030-02-02",
    });
    expect(error).not.toBeNull();
  });
});

describe("admin", () => {
  it("sees every owner's properties", async () => {
    const { data } = await asAdmin.from("properties").select("id").in("id", [ids.propA, ids.propB]);
    expect(data?.map((p) => p.id).sort()).toEqual([ids.propA, ids.propB].sort());
  });

  it("sees channels with iCal URLs", async () => {
    const { data } = await asAdmin
      .from("channels")
      .select("ical_url")
      .in("property_id", [ids.propA, ids.propB]);
    expect(data).toHaveLength(2);
  });
});

describe("anonymous visitor", () => {
  it("cannot read properties, reservations or channels", async () => {
    const anon = anonClient();
    for (const table of ["properties", "reservations", "channels"]) {
      const { data } = await anon.from(table).select("id");
      expect(data ?? []).toEqual([]);
    }
  });
});
