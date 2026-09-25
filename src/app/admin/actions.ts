"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { parseChannel, parseInvite, parseProperty, type FieldErrors } from "@/lib/admin/forms";
import { requireRole } from "@/lib/auth";
import { DEMO_READ_ONLY_MESSAGE, isDemoMode } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { summarize, syncNow } from "@/lib/sync/server";

/**
 * Server actions are public endpoints, so every action starts with
 * requireRole("admin"). Writes go through the user's client, so RLS admin
 * policies apply as a second line of defence.
 */

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  /** What was submitted, so a form keeps its input after a validation error. */
  values?: Record<string, string>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const success = (message: string): ActionState => ({ status: "success", message });
const failure = (message: string, fieldErrors?: FieldErrors): ActionState => ({ status: "error", message, fieldErrors });
const invalid = (fieldErrors: FieldErrors, form: FormData): ActionState => ({
  ...failure("Please fix the highlighted fields.", fieldErrors),
  values: submitted(form),
});

function submitted(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

/** For actions that change data: admins only, and never in the public demo. */
async function blockedWrite(): Promise<ActionState | null> {
  await requireRole("admin");
  return isDemoMode() ? failure(DEMO_READ_ONLY_MESSAGE) : null;
}

function idFrom(form: FormData): string | null {
  const id = String(form.get("id") ?? "");
  return UUID.test(id) ? id : null;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export async function refreshNow(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole("admin");
  const propertyId = idFrom(form);

  const summary = summarize(await syncNow("manual", propertyId ? [propertyId] : undefined));
  refresh();

  const changes = `${summary.upserted} updated, ${summary.cancelled} cancelled`;
  if (summary.ok) return success(`Synced ${summary.channels} channels: ${changes}.`);
  return failure(`${summary.failed} of ${summary.channels} channels failed (${changes}). See the red markers.`);
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export async function saveProperty(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;
  const parsed = parseProperty(form);
  if (!parsed.ok) return invalid(parsed.errors, form);

  const id = idFrom(form);
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("properties").update(parsed.value).eq("id", id)
    : await supabase.from("properties").insert(parsed.value);

  if (isUniqueViolation(error)) {
    return invalid({ booking_property_id: "Another property already uses this Booking.com ID." }, form);
  }
  if (error) return failure("Could not save the property. Try again.");

  refresh();
  return success(id ? "Property saved." : `Added ${parsed.value.name}.`);
}

export async function deleteProperty(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;
  const id = idFrom(form);
  if (!id) return failure("Unknown property.");

  // Channels and reservations are removed by ON DELETE CASCADE.
  const { error } = await (await createClient()).from("properties").delete().eq("id", id);
  if (error) return failure("Could not delete the property.");

  refresh();
  return success("Property deleted.");
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function addChannel(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;
  // Plain http is only accepted locally, for testing against a local feed.
  const parsed = parseChannel(form, { allowHttp: process.env.NODE_ENV !== "production" });
  if (!parsed.ok) return invalid(parsed.errors, form);

  const { error } = await (await createClient()).from("channels").insert(parsed.value);
  if (error) return failure("Could not add the channel.");

  // Import the new feed right away instead of waiting for the next cron run.
  const summary = summarize(await syncNow("manual", [parsed.value.property_id]));
  refresh();
  return summary.ok
    ? success(`Channel added and synced: ${summary.upserted} stays imported.`)
    : failure("Channel added, but the first sync failed. Check the link; the error is shown on the channel.");
}

export async function deleteChannel(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;
  const id = idFrom(form);
  if (!id) return failure("Unknown channel.");

  // Its reservations go with it (ON DELETE CASCADE).
  const { error } = await (await createClient()).from("channels").delete().eq("id", id);
  if (error) return failure("Could not delete the channel.");

  refresh();
  return success("Channel deleted.");
}

// ---------------------------------------------------------------------------
// Owners
// ---------------------------------------------------------------------------

export async function inviteOwner(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;
  const parsed = parseInvite(form);
  if (!parsed.ok) return invalid(parsed.errors, form);

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // Inviting needs the Auth admin API, hence the secret-key client.
  // The profile row (role 'owner') is created by the on_auth_user_created trigger.
  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(parsed.value.email, {
    data: { full_name: parsed.value.full_name },
    redirectTo: `${origin}/auth/confirm`,
  });

  if (error?.code === "email_exists" || /already been registered/i.test(error?.message ?? "")) {
    return invalid({ email: "This person already has an account." }, form);
  }
  if (error) return failure("Could not send the invitation. Try again.");

  refresh();
  return success(`Invitation sent to ${parsed.value.email}.`);
}
