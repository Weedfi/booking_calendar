"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { parseChannel, parseInvite, parseProperty, type FieldErrors } from "@/lib/admin/forms";
import { requireRole } from "@/lib/auth";
import { isDateKey, todayKey } from "@/lib/dates";
import { parseBookingExport } from "@/lib/import/booking-export";
import { planImport } from "@/lib/import/plan";
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
  ...failure("Popraw zaznaczone pola.", fieldErrors),
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

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export async function refreshNow(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole("admin");
  const propertyId = idFrom(form);

  const summary = summarize(await syncNow("manual", propertyId ? [propertyId] : undefined));
  refresh();

  const changes = `zmienione: ${summary.upserted}, anulowane: ${summary.cancelled}`;
  if (summary.ok) return success(`Zsynchronizowano kanały (${summary.channels}): ${changes}.`);
  return failure(`Błąd w ${summary.failed} z ${summary.channels} kanałów (${changes}). Zobacz czerwone oznaczenia.`);
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

  if (error) return failure("Nie udało się zapisać mieszkania. Spróbuj ponownie.");

  refresh();
  return success(id ? "Zapisano zmiany." : `Dodano: ${parsed.value.name}.`);
}

export async function deleteProperty(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;
  const id = idFrom(form);
  if (!id) return failure("Nieznane mieszkanie.");

  // Channels and reservations are removed by ON DELETE CASCADE.
  const { error } = await (await createClient()).from("properties").delete().eq("id", id);
  if (error) return failure("Nie udało się usunąć mieszkania.");

  refresh();
  return success("Mieszkanie usunięte.");
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
  if (error) return failure("Nie udało się dodać kanału.");

  // Import the new feed right away instead of waiting for the next cron run.
  const summary = summarize(await syncNow("manual", [parsed.value.property_id]));
  refresh();
  return summary.ok
    ? success(`Kanał dodany i zsynchronizowany. Zaimportowane pobyty: ${summary.upserted}.`)
    : failure("Kanał dodany, ale pierwsza synchronizacja się nie udała. Sprawdź link; błąd widać przy kanale.");
}

export async function deleteChannel(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;
  const id = idFrom(form);
  if (!id) return failure("Nieznany kanał.");

  // Its reservations go with it (ON DELETE CASCADE).
  const { error } = await (await createClient()).from("channels").delete().eq("id", id);
  if (error) return failure("Nie udało się usunąć kanału.");

  refresh();
  return success("Kanał usunięty.");
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
    return invalid({ email: "Ta osoba ma już konto." }, form);
  }
  if (error) return failure("Nie udało się wysłać zaproszenia. Spróbuj ponownie.");

  refresh();
  return success(`Zaproszenie wysłane na ${parsed.value.email}.`);
}

// ---------------------------------------------------------------------------
// History import
// ---------------------------------------------------------------------------

// Below the 4 MB server action limit in next.config.ts, leaving room for form overhead.
const MAX_IMPORT_BYTES = 3.5 * 1024 * 1024;

export async function importHistory(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return failure("Wybierz plik z listą rezerwacji.");
  if (file.size > MAX_IMPORT_BYTES) return failure("Plik jest za duży (limit 3,5 MB). Wybierz krótszy zakres dat.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = decodeUpload(bytes);
  if (text === null) {
    return failure("To jest plik Excel. Otwórz go w Excelu, wybierz Plik → Zapisz jako → CSV UTF-8 i zaimportuj ten plik.");
  }

  const parsed = parseBookingExport(text);
  if (!parsed.ok) return failure(parsed.error);

  const supabase = await createClient();
  const [properties, channels] = await Promise.all([
    supabase.from("properties").select("id, name, booking_room_name"),
    supabase.from("channels").select("id, property_id, source"),
  ]);
  if (properties.error || channels.error) return failure("Nie udało się wczytać mieszkań. Spróbuj ponownie.");

  const plan = planImport(
    parsed.rows,
    properties.data.map((p) => ({
      id: p.id,
      name: p.name,
      bookingRoomName: p.booking_room_name,
      channels: channels.data.filter((c) => c.property_id === p.id).map((c) => ({ id: c.id, source: c.source })),
    })),
    todayKey(),
  );

  if (plan.records.length > 0) {
    // Re-importing the same file updates the same rows (stable external UIDs).
    const { error } = await supabase.from("reservations").upsert(plan.records, { onConflict: "channel_id,external_uid" });
    if (error) return failure("Nie udało się zapisać rezerwacji. Spróbuj ponownie.");
  }

  // Guest names, past and future. Priority: manual > import > email, so a
  // name typed by hand is kept; earlier imported or emailed names are replaced.
  let guestsSaved = 0;
  let guestsKeptManual = 0;
  if (plan.guests.length > 0) {
    const { data: manual, error: readError } = await supabase
      .from("guest_stays")
      .select("property_id, start_date, end_date")
      .eq("source", "manual")
      .in("property_id", [...new Set(plan.guests.map((g) => g.property_id))]);
    if (readError) return failure("Nie udało się wczytać gości. Spróbuj ponownie.");
    const keep = new Set(manual.map((m) => `${m.property_id}|${m.start_date}|${m.end_date}`));
    const rows = plan.guests
      .filter((g) => !keep.has(`${g.property_id}|${g.start_date}|${g.end_date}`))
      .map((g) => ({ ...g, source: "import" as const }));
    if (rows.length > 0) {
      const { error } = await supabase.from("guest_stays").upsert(rows, { onConflict: "property_id,start_date,end_date" });
      if (error) return failure("Nie udało się zapisać gości. Spróbuj ponownie.");
    }
    guestsSaved = rows.length;
    guestsKeptManual = plan.guests.length - rows.length;
  }
  if (plan.records.length > 0 || guestsSaved > 0) refresh();

  const notes = [
    plan.skipped.notFinished &&
      `trwające i przyszłe: ${plan.skipped.notFinished} (terminy przychodzą z kalendarza Booking.com)`,
    guestsKeptManual && `imiona wpisane ręcznie zostawione bez zmian: ${guestsKeptManual}`,
    plan.skipped.cancelled && `anulowane: ${plan.skipped.cancelled}`,
    parsed.invalid && `nieczytelne wiersze: ${parsed.invalid}`,
    plan.skipped.unknownRooms.length > 0 &&
      `nierozpoznane pokoje: ${plan.skipped.unknownRooms.join(", ")} (wpisz ich nazwę w polu „Nazwa pokoju w Booking.com”)`,
    plan.skipped.noChannel.length > 0 && `mieszkania bez kanału: ${plan.skipped.noChannel.join(", ")} (najpierw dodaj kanał Booking.com)`,
  ].filter(Boolean);
  const summary = `Zaimportowane zakończone pobyty: ${plan.records.length}. Imiona gości: ${guestsSaved}.${notes.length ? ` Pozostałe: ${notes.join("; ")}.` : ""}`;

  return plan.records.length === 0 && guestsSaved === 0 && (plan.skipped.unknownRooms.length > 0 || plan.skipped.noChannel.length > 0)
    ? failure(summary)
    : success(summary);
}

/** UTF-8, UTF-16 (BOM) or Windows-1250 text; null for a binary Excel file. */
function decodeUpload(bytes: Uint8Array): string | null {
  const isXls = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b; // zip container
  if (isXls || isXlsx) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Polish Excel on Windows often saves CSV in Windows-1250.
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

// ---------------------------------------------------------------------------
// Guest names
// ---------------------------------------------------------------------------

/**
 * Sets the guest name for a stay (apartment + dates), or removes it when the
 * name is empty. A name entered here always wins over one read from emails.
 */
export async function saveGuestName(_prev: ActionState, form: FormData): Promise<ActionState> {
  const blocked = await blockedWrite();
  if (blocked) return blocked;

  const propertyId = String(form.get("property_id") ?? "");
  const startDate = String(form.get("start_date") ?? "");
  const endDate = String(form.get("end_date") ?? "");
  const guestName = String(form.get("guest_name") ?? "").trim().replace(/\s+/g, " ");
  if (!UUID.test(propertyId) || !isDateKey(startDate) || !isDateKey(endDate) || endDate <= startDate) {
    return failure("Nieznana rezerwacja.");
  }
  if (guestName.length > 200) return invalid({ guest_name: "Imię i nazwisko może mieć najwyżej 200 znaków." }, form);

  const supabase = await createClient();
  const key = { property_id: propertyId, start_date: startDate, end_date: endDate };
  const { error } = guestName
    ? await supabase.from("guest_stays").upsert({ ...key, guest_name: guestName, source: "manual" }, { onConflict: "property_id,start_date,end_date" })
    : await supabase.from("guest_stays").delete().match(key);
  if (error) return failure("Nie udało się zapisać gościa. Spróbuj ponownie.");

  refresh();
  return success(guestName ? "Zapisano gościa." : "Usunięto gościa.");
}
