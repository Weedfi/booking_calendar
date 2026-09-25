import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { buildDashboard, loadDashboardData } from "@/lib/admin/dashboard";
import { requireRole } from "@/lib/auth";
import { CHANNELS } from "@/lib/calendar/channels";
import { parseAdminFilters } from "@/lib/calendar/filters";
import { formatDate, todayKey } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { FilterBar } from "./_components/filter-bar";
import { RangeNav } from "./_components/range-nav";
import { TapeChart } from "./_components/tape-chart";
import { TurnoverPanel, UpcomingList } from "./_components/turnovers";

export const metadata: Metadata = { title: "Calendar" };

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireRole("admin");

  const now = new Date();
  const today = todayKey(now);
  const requested = parseAdminFilters(await searchParams, today);
  const supabase = await createClient();
  const data = await loadDashboardData(supabase, requested, today);
  const dashboard = buildDashboard(data, requested, today, now);
  const monthLabel = formatDate(dashboard.occupancyMonth.start, { weekday: undefined, day: undefined });

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4">
        <FilterBar
          key={JSON.stringify(dashboard.filters)}
          filters={dashboard.filters} owners={dashboard.owners} properties={dashboard.propertyOptions} />

        {/* Mobile: a list of upcoming turnovers instead of the tape chart. */}
        <div className="md:hidden">
          <UpcomingList days={dashboard.turnovers} today={today} />
        </div>

        <div className="hidden flex-col gap-4 md:flex">
          <TurnoverPanel days={dashboard.turnovers} today={today} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <RangeNav filters={dashboard.filters} today={today} />
            <Legend />
          </div>
          <TapeChart
            rows={dashboard.rows}
            days={dashboard.days}
            today={today}
            occupancyLabel={`${monthLabel} occupancy`}
          />
        </div>
      </main>
    </>
  );
}

function Legend() {
  return (
    <ul className="flex items-center gap-3 text-xs text-slate-600" aria-label="Channel colors">
      {Object.values(CHANNELS).map(({ label, color }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
