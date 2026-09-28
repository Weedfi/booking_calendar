import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { loadManagedProperties, loadOwnerOptions, type ManagedChannel } from "@/lib/admin/manage";
import { requireRole } from "@/lib/auth";
import { CHANNELS } from "@/lib/calendar/channels";
import { formatRelative } from "@/lib/calendar/stats";
import { createClient } from "@/lib/supabase/server";
import { deleteChannel, deleteProperty } from "../actions";
import { DeleteButton } from "../_components/delete-button";
import { RefreshButton } from "../_components/refresh-button";
import { ChannelForm } from "./_components/channel-form";
import { ImportForm } from "./_components/import-form";
import { PropertyForm } from "./_components/property-form";

export const metadata: Metadata = { title: "Mieszkania" };

// Adding a channel runs its first sync inside the server action.
export const maxDuration = 60;

export default async function PropertiesPage() {
  const user = await requireRole("admin");
  const supabase = await createClient();
  const [properties, owners] = await Promise.all([loadManagedProperties(supabase), loadOwnerOptions(supabase)]);
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const now = new Date();

  return (
    <>
      <AppHeader user={user} active="properties" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Mieszkania ({properties.length})</h1>
          <RefreshButton label="Synchronizuj wszystko" />
        </div>

        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-medium">Dodaj mieszkanie</summary>
          <div className="mt-4">
            <PropertyForm owners={owners} />
          </div>
        </details>

        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-medium">Importuj historię rezerwacji z Booking.com</summary>
          <p className="mt-2 mb-3 text-sm text-slate-600">
            Kalendarz iCal z Booking.com obejmuje tylko dni od dzisiaj. Starsze rezerwacje możesz uzupełnić z listy
            rezerwacji pobranej z extranetu.
          </p>
          <ImportForm />
        </details>

        {properties.map((p) => (
          <section key={p.id} aria-label={p.name} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="size-3 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                  {p.name}
                </h2>
                <p className="text-sm text-slate-600">
                  {[p.address, p.owner_id ? ownerName.get(p.owner_id) : "Bez właściciela", p.booking_property_id &&
                      `Obiekt Booking.com ${p.booking_property_id}${p.booking_room_name ? ` · pokój: ${p.booking_room_name}` : ""}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <DeleteButton
                action={deleteProperty}
                id={p.id}
                label="Usuń"
                confirmText={`Usunąć ${p.name} razem ze wszystkimi kanałami i rezerwacjami? Tej operacji nie można cofnąć.`}
              />
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-slate-700">Edytuj dane</summary>
              <div className="mt-3">
                <PropertyForm
                  owners={owners}
                  values={{
                    id: p.id,
                    name: p.name,
                    address: p.address,
                    owner_id: p.owner_id,
                    color: p.color,
                    booking_property_id: p.booking_property_id,
                    booking_room_name: p.booking_room_name,
                  }}
                />
              </div>
            </details>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-slate-700">Kanały</h3>
                {p.channels.length > 0 && <RefreshButton propertyId={p.id} label="Synchronizuj to mieszkanie" />}
              </div>
              {p.channels.length === 0 ? (
                <p className="mb-3 text-sm text-slate-500">Brak kanałów. Wklej link eksportu iCal z Booking.com lub Airbnb.</p>
              ) : (
                <ul className="mb-3 flex flex-col divide-y divide-slate-100">
                  {p.channels.map((c) => (
                    <ChannelRow key={c.id} channel={c} now={now} />
                  ))}
                </ul>
              )}
              <ChannelForm propertyId={p.id} />
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

function ChannelRow({ channel: c, now }: { channel: ManagedChannel; now: Date }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: CHANNELS[c.source].color }} aria-hidden />
      <span className="font-medium">{CHANNELS[c.source].label}</span>
      <code className="text-xs text-slate-500">{c.maskedUrl}</code>
      <span className={`text-xs ${c.lastSyncError ? "text-red-700" : "text-slate-500"}`}>
        {c.lastSyncError
          ? `Błąd: ${c.lastSyncError}`
          : c.lastSyncedAt
            ? `Sync. ${formatRelative(new Date(c.lastSyncedAt), now)}`
            : "Nigdy nie synchronizowano"}
      </span>
      <span className="ml-auto">
        <DeleteButton
          action={deleteChannel}
          id={c.id}
          label="Usuń"
          confirmText={`Usunąć kanał ${CHANNELS[c.source].label} i jego rezerwacje?`}
        />
      </span>
    </li>
  );
}
