import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { ChannelSource } from "@/lib/calendar/tape-chart";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskUrl } from "./forms";

export type ManagedChannel = {
  id: string;
  source: ChannelSource;
  /** Masked, e.g. "ical.booking.com/…a1b2". The full URL never leaves the server. */
  maskedUrl: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export type ManagedProperty = {
  id: string;
  name: string;
  address: string | null;
  color: string;
  owner_id: string | null;
  booking_property_id: string | null;
  booking_room_name: string | null;
  channels: ManagedChannel[];
};

export async function loadManagedProperties(supabase: SupabaseClient<Database>): Promise<ManagedProperty[]> {
  const [properties, channels] = await Promise.all([
    supabase.from("properties").select("id, name, address, color, owner_id, booking_property_id, booking_room_name").order("name"),
    supabase
      .from("channels")
      .select("id, property_id, source, ical_url, last_synced_at, last_sync_error")
      .order("created_at"),
  ]);
  if (properties.error) throw properties.error;
  if (channels.error) throw channels.error;

  return properties.data.map((p) => ({
    ...p,
    channels: channels.data
      .filter((c) => c.property_id === p.id)
      .map((c) => ({
        id: c.id,
        source: c.source,
        maskedUrl: maskUrl(c.ical_url),
        lastSyncedAt: c.last_synced_at,
        lastSyncError: c.last_sync_error,
      })),
  }));
}

export type OwnerSummary = {
  id: string;
  name: string;
  email: string | null;
  /** Invited but has not opened the invitation yet. */
  pending: boolean;
  propertyNames: string[];
};

export async function loadOwners(supabase: SupabaseClient<Database>): Promise<OwnerSummary[]> {
  const [profiles, properties, users] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "owner").order("full_name"),
    supabase.from("properties").select("name, owner_id").order("name"),
    // Emails live in auth.users, which only the Auth admin API can list.
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (profiles.error) throw profiles.error;
  if (properties.error) throw properties.error;
  if (users.error) throw users.error;

  const userById = new Map(users.data.users.map((u) => [u.id, u]));
  return profiles.data.map((p) => {
    const user = userById.get(p.id);
    return {
      id: p.id,
      name: p.full_name ?? "Właściciel bez nazwy",
      email: user?.email ?? null,
      pending: Boolean(user?.invited_at) && !user?.last_sign_in_at,
      propertyNames: properties.data.filter((x) => x.owner_id === p.id).map((x) => x.name),
    };
  });
}

export async function loadOwnerOptions(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("profiles").select("id, full_name").eq("role", "owner").order("full_name");
  if (error) throw error;
  return data.map((o) => ({ id: o.id, name: o.full_name ?? "Właściciel bez nazwy" }));
}
