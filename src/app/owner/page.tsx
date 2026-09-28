import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { LiveUpdates } from "@/components/live-updates";
import { requireRole } from "@/lib/auth";
import { CHANNELS } from "@/lib/calendar/channels";
import { daysBetween, formatDate, todayKey, type DateKey } from "@/lib/dates";
import { loadOwnerView, monthParam, parseOwnerParams, type OwnerStay } from "@/lib/owner/view";
import { createClient } from "@/lib/supabase/server";
import { MonthCalendar } from "./_components/month-calendar";
import { nightsLabel } from "@/lib/i18n";

export const metadata: Metadata = { title: "Moje mieszkania" };

export default async function OwnerPage({ searchParams }: PageProps<"/owner">) {
  const user = await requireRole("owner");
  const today = todayKey();
  const params = parseOwnerParams(await searchParams, today);
  const view = await loadOwnerView(await createClient(), params, today);

  if (!view) {
    return (
      <>
        <AppHeader user={user} />
        <main className="mx-auto w-full max-w-xl p-4">
          <h1 className="text-xl font-semibold">Moje mieszkania</h1>
          <p className="mt-2 text-slate-600">Do Twojego konta nie są jeszcze przypisane żadne mieszkania. Skontaktuj się z zarządcą.</p>
        </main>
      </>
    );
  }

  const href = (propertyId: string, month: DateKey) => `/owner?property=${propertyId}&month=${monthParam(month)}`;
  const monthName = formatDate(view.month, { weekday: undefined, day: undefined, month: "long" });

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
        {view.properties.length > 1 && (
          <nav aria-label="Twoje mieszkania" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {view.properties.map((p) => (
              <Link
                key={p.id}
                href={href(p.id, view.month)}
                aria-current={p.id === view.property.id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                  p.id === view.property.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                {p.name}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{view.property.name}</h1>
            {view.property.address && <p className="text-sm text-slate-600">{view.property.address}</p>}
          </div>
          <LiveUpdates propertyNames={Object.fromEntries(view.properties.map((p) => [p.id, p.name]))} />
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <Stat label={`Obłożenie (${monthName})`} value={view.occupancy === null ? "—" : `${Math.round(view.occupancy * 100)}%`} />
          <Stat label={`Zajęte noce (${monthName})`} value={String(view.bookedNights)} />
        </dl>

        {view.closedUntil && (
          <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            <span className="font-semibold">🔒 Zablokowane</span> w Booking.com do {formatDate(view.closedUntil)}.
            Ten okres nie liczy się do obłożenia.
          </p>
        )}

        {view.current && (
          <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">
            <span className="font-semibold">
              Gość jest teraz na miejscu
            </span>{" "}
            · wymeldowanie {formatDate(view.current.endDate)}
          </p>
        )}

        <MonthCalendar
          weeks={view.weeks}
          month={view.month}
          prevHref={href(view.property.id, view.prevMonth)}
          nextHref={href(view.property.id, view.nextMonth)}
        />

        <section aria-label="Najbliższe pobyty">
          <h2 className="mb-2 font-semibold">Najbliższe pobyty</h2>
          {view.upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Brak zaplanowanych pobytów.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {view.upcoming.map((s) => (
                <UpcomingStay key={s.id} stay={s} today={today} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function UpcomingStay({ stay, today }: { stay: OwnerStay; today: DateKey }) {
  const nights = daysBetween(stay.startDate, stay.endDate);
  const inDays = daysBetween(today, stay.startDate);

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div>
        <p className="font-medium">
          {formatDate(stay.startDate)} → {formatDate(stay.endDate)}
        </p>
        <p className="text-sm text-slate-500">
          {[nightsLabel(nights), CHANNELS[stay.source].label].join(" · ")}
        </p>
      </div>
      <span className="shrink-0 text-xs text-slate-500">
        {inDays === 0 ? "Dziś" : inDays === 1 ? "Jutro" : `za ${inDays} dni`}
      </span>
    </li>
  );
}
