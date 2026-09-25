import type { Dashboard, StayWithProperty } from "@/lib/admin/dashboard";
import { nights } from "@/lib/admin/dashboard";
import { CHANNELS } from "@/lib/calendar/channels";
import { formatDate, type DateKey } from "@/lib/dates";

type Day = Dashboard["turnovers"][number];

function dayTitle(day: DateKey, today: DateKey, index: number): string {
  if (day === today) return `Today · ${formatDate(day)}`;
  if (index === 1) return `Tomorrow · ${formatDate(day)}`;
  return formatDate(day, { weekday: "long" });
}

/** Desktop: today's and tomorrow's check-outs and check-ins (the cleaning plan). */
export function TurnoverPanel({ days, today }: { days: Day[]; today: DateKey }) {
  return (
    <section aria-label="Today and tomorrow" className="grid gap-4 md:grid-cols-2">
      {days.slice(0, 2).map((day, i) => (
        <div key={day.day} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">{dayTitle(day.day, today, i)}</h2>
          <TurnoverDay day={day} />
        </div>
      ))}
    </section>
  );
}

/** Mobile: the next 7 days as a list, instead of the tape chart. */
export function UpcomingList({ days, today }: { days: Day[]; today: DateKey }) {
  return (
    <section aria-label="Upcoming check-ins and check-outs" className="flex flex-col gap-3">
      {days.map((day, i) => (
        <div key={day.day} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">{dayTitle(day.day, today, i)}</h2>
          <TurnoverDay day={day} />
        </div>
      ))}
    </section>
  );
}

function TurnoverDay({ day }: { day: Day }) {
  if (day.checkIns.length === 0 && day.checkOuts.length === 0) {
    return <p className="text-sm text-slate-500">No check-ins or check-outs.</p>;
  }
  const arriving = new Set(day.checkIns.map((s) => s.property.id));

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TurnoverList title="Check-outs" stays={day.checkOuts} sameDay={arriving} />
      <TurnoverList title="Check-ins" stays={day.checkIns} />
    </div>
  );
}

function TurnoverList({ title, stays, sameDay }: { title: string; stays: StayWithProperty[]; sameDay?: Set<string> }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
        {title} ({stays.length})
      </h3>
      {stays.length === 0 ? (
        <p className="text-sm text-slate-400">None</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {stays.map(({ reservation, property }) => (
            <li key={reservation.id} className="flex items-center gap-2 text-sm">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: property.color }} aria-hidden />
              <span className="truncate">{property.name}</span>
              {sameDay?.has(property.id) && (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 text-xs text-amber-900" title="A new guest arrives the same day">
                  Same-day turnover
                </span>
              )}
              <span className="ml-auto shrink-0 text-xs text-slate-500">
                {CHANNELS[reservation.source].label} · {nights(reservation)}n
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
