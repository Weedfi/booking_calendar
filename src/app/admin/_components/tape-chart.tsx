import type { CSSProperties } from "react";
import type { DashboardRow, SyncSummary } from "@/lib/admin/dashboard";
import { nights } from "@/lib/admin/dashboard";
import { CHANNELS } from "@/lib/calendar/channels";
import type { Bar } from "@/lib/calendar/tape-chart";
import { formatDate, type DateKey } from "@/lib/dates";
import { nightsLabel } from "@/lib/i18n";

type Props = {
  rows: DashboardRow[];
  days: DateKey[];
  today: DateKey;
  occupancyLabel: string;
};

const LABEL_WIDTH = "16rem";

/**
 * Rows are properties, columns are days split into halves: a stay runs from
 * the afternoon of check-in to the morning of checkout. Every row is its own
 * grid with the same column template, so the columns line up.
 */
export function TapeChart({ rows, days, today, occupancyLabel }: Props) {
  const minHalf = days.length > 14 ? "0.8rem" : "1.6rem";
  const grid: CSSProperties = {
    gridTemplateColumns: `${LABEL_WIDTH} repeat(${days.length * 2}, minmax(${minHalf}, 1fr))`,
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-max">
        <div className="grid border-b border-slate-200 text-xs" style={grid}>
          <div className="sticky left-0 z-20 flex items-end bg-white px-3 py-2 font-medium text-slate-500">
            Mieszkanie · {occupancyLabel}
          </div>
          {days.map((day, i) => (
            <div
              key={day}
              style={{ gridColumn: `${2 + i * 2} / span 2` }}
              className={`border-l border-slate-100 py-1 text-center ${
                day === today ? "bg-amber-100 font-semibold text-amber-900" : isWeekend(day) ? "bg-slate-50 text-slate-500" : "text-slate-500"
              }`}
            >
              <div>{formatDate(day, { day: undefined, month: undefined })}</div>
              <div className="text-sm text-slate-800">{formatDate(day, { weekday: undefined, month: undefined })}</div>
              {(i === 0 || day.endsWith("-01")) && (
                <div className="font-medium">{formatDate(day, { weekday: undefined, day: undefined })}</div>
              )}
            </div>
          ))}
        </div>

        {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Żadne mieszkanie nie pasuje do filtrów.</p>}

        {rows.map((row) => (
          <div
            key={row.property.id}
            className="grid border-b border-slate-100 last:border-b-0"
            style={{ ...grid, gridTemplateRows: `repeat(${row.layout.laneCount}, 2.25rem)` }}
          >
            <PropertyLabel row={row} />
            {days.map((day, i) => (
              <div
                key={day}
                aria-hidden
                style={{ gridColumn: `${2 + i * 2} / span 2`, gridRow: `1 / span ${row.layout.laneCount}` }}
                className={`border-l border-slate-100 ${day === today ? "bg-amber-50" : isWeekend(day) ? "bg-slate-50" : ""}`}
              />
            ))}
            {row.closures.map((bar) => (
              <ClosureBand key={bar.reservation.id} bar={bar} laneCount={row.layout.laneCount} />
            ))}
            {row.layout.bars.map((bar) => (
              <ReservationBar key={bar.reservation.id} bar={bar} propertyName={row.property.name} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyLabel({ row }: { row: DashboardRow }) {
  const { property } = row;
  return (
    <div
      className="sticky left-0 z-20 flex flex-col justify-center gap-0.5 border-r border-slate-200 bg-white px-3 py-1"
      style={{ gridRow: `1 / span ${row.layout.laneCount}` }}
    >
      <div className="flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: property.color }} aria-hidden />
        <span className="truncate text-sm font-medium">{property.name}</span>
        <span
          className="ml-auto text-xs tabular-nums text-slate-500"
          title={row.occupancy === null ? "Cały miesiąc zamknięty na rezerwacje" : "Obłożenie otwartych dni w miesiącu"}
        >
          {row.occupancy === null ? "—" : `${Math.round(row.occupancy * 100)}%`}
        </span>
      </div>
      <div className="flex items-center gap-2 pl-4.5 text-xs text-slate-500">
        <span className="truncate">{property.ownerName ?? "Bez właściciela"}</span>
        <SyncBadge sync={row.sync} />
      </div>
    </div>
  );
}

function SyncBadge({ sync }: { sync: SyncSummary }) {
  const dot = { ok: "bg-emerald-500", error: "bg-red-500", never: "bg-slate-300" }[sync.state];
  const title = sync.state === "error" ? sync.errors.join("\n") : undefined;
  return (
    <span className={`ml-auto flex shrink-0 items-center gap-1 ${sync.state === "error" ? "text-red-700" : ""}`} title={title}>
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
      {sync.state === "error" ? "Błąd synchronizacji" : sync.label}
    </span>
  );
}

function ReservationBar({ bar, propertyName }: { bar: Bar; propertyName: string }) {
  const { reservation: r } = bar;
  const channel = CHANNELS[r.source];
  const n = nights(r);
  const dates = `${formatDate(r.startDate)} → ${formatDate(r.endDate)}`;
  const description = [propertyName, channel.label, dates, nightsLabel(n)].join(", ");
  const wide = bar.endHalf - bar.startHalf >= 2;

  return (
    <div
      role="img"
      aria-label={description}
      title={description}
      className={`relative z-10 my-1 flex items-center overflow-hidden px-2 text-xs font-medium whitespace-nowrap text-white shadow-sm ${
        bar.clippedStart ? "rounded-l-none" : "rounded-l-full"
      } ${bar.clippedEnd ? "rounded-r-none" : "rounded-r-full"}`}
      style={{
        gridColumn: `${2 + bar.startHalf} / ${2 + bar.endHalf}`,
        gridRow: bar.lane + 1,
        backgroundColor: channel.color,
      }}
    >
      {wide ? `${n} n.` : ""}
    </div>
  );
}

/** A period closed for sale: a hatched band behind the stays, not a booking. */
function ClosureBand({ bar, laneCount }: { bar: Bar; laneCount: number }) {
  const { reservation: r } = bar;
  const description = `Zamknięte na rezerwacje: ${formatDate(r.startDate)} → ${formatDate(r.endDate)}`;
  return (
    <div
      role="img"
      aria-label={description}
      title={description}
      className="z-[5] my-1 flex items-center overflow-hidden px-2 text-xs font-medium whitespace-nowrap text-slate-600"
      style={{
        gridColumn: `${2 + bar.startHalf} / ${2 + bar.endHalf}`,
        gridRow: `1 / span ${laneCount}`,
        background: "repeating-linear-gradient(135deg, #e2e8f0 0 6px, #f1f5f9 6px 12px)",
      }}
    >
      Zamknięte
    </div>
  );
}

function isWeekend(day: DateKey): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}
