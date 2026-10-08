import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { LiveUpdates } from "@/components/live-updates";
import { requireRole } from "@/lib/auth";
import { CHANNELS } from "@/lib/calendar/channels";
import { daysBetween, formatDate, todayKey, type DateKey } from "@/lib/dates";
import { loadOwnerView, monthParam, parseOwnerParams, type OwnerProperty, type OwnerStay } from "@/lib/owner/view";
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
        <AppHeader user={user} width="max-w-5xl" />
        <main className="mx-auto w-full max-w-5xl p-4">
          <h1 className="text-xl font-semibold">Moje mieszkania</h1>
          <p className="mt-2 text-slate-600">Do Twojego konta nie są jeszcze przypisane żadne mieszkania. Skontaktuj się z zarządcą.</p>
        </main>
      </>
    );
  }

  const href = (propertyId: string, month: DateKey) => `/owner?property=${propertyId}&month=${monthParam(month)}`;
  const monthName = formatDate(view.month, { weekday: undefined, day: undefined, month: "long" });

  const multiple = view.properties.length > 1;
  return (
    <>
      <AppHeader user={user} width={multiple ? "max-w-7xl" : "max-w-5xl"} />
      <main
        className={`mx-auto grid w-full gap-4 p-4 lg:gap-6 lg:py-6 ${
          multiple ? "max-w-7xl lg:grid-cols-[15rem_minmax(0,1fr)]" : "max-w-5xl"
        }`}
      >
        {multiple && (
          <PropertyNav properties={view.properties} currentId={view.property.id} href={(id) => href(id, view.month)} />
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold lg:text-2xl">{view.property.name}</h1>
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
              <span className="font-semibold">Zamknięte na rezerwacje</span> w Booking.com do {formatDate(view.closedUntil)}.
              Ten okres nie liczy się do obłożenia.
            </p>
          )}

          {view.current && (
            <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">
              <span className="font-semibold">Gość jest teraz na miejscu</span> · wymeldowanie {formatDate(view.current.endDate)}
            </p>
          )}

          {/* Side by side on wide screens, stacked on phones. */}
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <MonthCalendar
              weeks={view.weeks}
              month={view.month}
              prevHref={href(view.property.id, view.prevMonth)}
              nextHref={href(view.property.id, view.nextMonth)}
            />

            <section aria-label="Najbliższe pobyty" className="xl:rounded-2xl xl:border xl:border-slate-200 xl:bg-white xl:p-4">
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
          </div>
        </div>
      </main>
    </>
  );
}

/** Scrollable chips on phones, a side list on desktop. */
function PropertyNav({
  properties,
  currentId,
  href,
}: {
  properties: OwnerProperty[];
  currentId: string;
  href: (id: string) => string;
}) {
  return (
    <nav aria-label="Twoje mieszkania" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
      <h2 className="mb-2 hidden px-2 text-xs font-medium tracking-wide text-slate-500 uppercase lg:block">
        Twoje mieszkania ({properties.length})
      </h2>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-2 [&::-webkit-scrollbar]:hidden">
        {properties.map((p) => {
          const current = p.id === currentId;
          return (
            <li key={p.id} className="shrink-0">
              <Link
                href={href(p.id)}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm lg:rounded-lg lg:border-transparent lg:py-2 ${
                  current
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                <span className="lg:line-clamp-2">{p.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
      <div className="min-w-0">
        <p className="font-medium whitespace-nowrap">
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
