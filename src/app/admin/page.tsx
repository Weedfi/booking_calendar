import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { LiveUpdates } from "@/components/live-updates";
import { buildDashboard, loadDashboardData } from "@/lib/admin/dashboard";
import { loadSyncStatus, type SyncStatus } from "@/lib/admin/sync-status";
import { requireRole } from "@/lib/auth";
import { CHANNELS } from "@/lib/calendar/channels";
import { CLOSURE_LABEL, CLOSURE_MIN_NIGHTS } from "@/lib/calendar/closures";
import type { ChannelSource } from "@/lib/calendar/tape-chart";
import { parseAdminFilters } from "@/lib/calendar/filters";
import { formatDate, todayKey } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "./_components/auto-refresh";
import { FilterBar } from "./_components/filter-bar";
import { RangeNav } from "./_components/range-nav";
import { RefreshButton } from "./_components/refresh-button";
import { TapeChart } from "./_components/tape-chart";
import { TurnoverPanel, UpcomingList } from "./_components/turnovers";

export const metadata: Metadata = { title: "Kalendarz" };

// "Refresh now" runs a full sync inside a server action on this page.
export const maxDuration = 60;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireRole("admin");

  const now = new Date();
  const today = todayKey(now);
  const requested = parseAdminFilters(await searchParams, today);
  const supabase = await createClient();
  const [data, syncStatus] = await Promise.all([
    loadDashboardData(supabase, requested, today),
    loadSyncStatus(supabase, now),
  ]);
  const dashboard = buildDashboard(data, requested, today, now);
  const monthLabel = formatDate(dashboard.occupancyMonth.start, { weekday: undefined, day: undefined, month: "long" });

  return (
    <>
      <AppHeader user={user} active="calendar" />
      <AutoRefresh />
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4">
        <SyncBar
          status={syncStatus}
          propertyNames={Object.fromEntries(data.properties.map((p) => [p.id, p.name]))}
        />
        <FilterBar
          key={JSON.stringify(dashboard.filters)}
          filters={dashboard.filters}
          owners={dashboard.owners}
          properties={dashboard.propertyOptions}
        />

        {/* Mobile: a list of upcoming turnovers instead of the tape chart. */}
        <div className="md:hidden">
          <UpcomingList days={dashboard.turnovers} today={today} />
        </div>

        <div className="hidden flex-col gap-4 md:flex">
          <TurnoverPanel days={dashboard.turnovers} today={today} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <RangeNav filters={dashboard.filters} today={today} />
            <Legend sources={new Set(data.channels.map((c) => c.source))} />
          </div>
          <TapeChart
            rows={dashboard.rows}
            days={dashboard.days}
            today={today}
            occupancyLabel={`obłożenie (${monthLabel})`}
          />
        </div>
      </main>
    </>
  );
}

function SyncBar({ status, propertyNames }: { status: SyncStatus; propertyNames: Record<string, string> }) {
  const tone = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    error: "border-red-200 bg-red-50 text-red-950",
    unknown: "border-slate-200 bg-white text-slate-700",
  }[status.tone];
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2 text-sm ${tone}`}>
      <p>
        <span className="font-medium">{status.text}</span>
        {status.detail && <span> · {status.detail}</span>}
      </p>
      <div className="flex items-center gap-3">
        <LiveUpdates propertyNames={propertyNames} />
        <RefreshButton />
      </div>
    </div>
  );
}

const LEGEND_NOTE =
  "Kalendarze iCal nie podają, kto i gdzie zarezerwował: rezerwacja, ręczna blokada i pobyt sprzedany w innym kanale " +
  "wyglądają tak samo, a pobyty dzień po dniu bywają sklejone w jeden pasek. " +
  `Bloki dłuższe niż ${CLOSURE_MIN_NIGHTS - 1} nocy (zwykle wyłączona sprzedaż) są pokazane osobno i nie liczą się do obłożenia.`;

/** Only the channels that are connected, so unused colors do not show up. */
function Legend({ sources }: { sources: Set<ChannelSource> }) {
  const channels = (Object.keys(CHANNELS) as ChannelSource[]).filter((s) => sources.has(s));
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600" aria-label="Legenda">
      {channels.map((source) => (
        <li key={source} className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: CHANNELS[source].color }} aria-hidden />
          {CHANNELS[source].occupied}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-5 rounded-sm"
          style={{ background: "repeating-linear-gradient(135deg, #cbd5e1 0 3px, #f1f5f9 3px 6px)" }}
          aria-hidden
        />
        {CLOSURE_LABEL}
      </li>
      <li>
        <span
          className="inline-flex size-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500"
          title={LEGEND_NOTE}
          aria-label={LEGEND_NOTE}
          role="img"
        >
          ?
        </span>
      </li>
    </ul>
  );
}
