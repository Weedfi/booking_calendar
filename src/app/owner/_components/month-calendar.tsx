import Link from "next/link";
import type { GridDay } from "@/lib/owner/month-grid";
import { formatDate, type DateKey } from "@/lib/dates";
import { capitalize } from "@/lib/i18n";

const BOOKED = "#a5b4fc"; // indigo-300: dark text stays readable on it
const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

type Props = {
  weeks: GridDay[][];
  month: DateKey;
  prevHref: string;
  nextHref: string;
};

/**
 * Month view with each day split diagonally: top-left is the morning (the
 * previous night), bottom-right the afternoon (the coming night). Check-in
 * and checkout days are therefore half-filled.
 */
export function MonthCalendar({ weeks, month, prevHref, nextHref }: Props) {
  return (
    <section aria-label="Kalendarz rezerwacji" className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link href={prevHref} className="rounded-lg px-3 py-2 text-lg hover:bg-slate-100" aria-label="Poprzedni miesiąc">
          ‹
        </Link>
        <h2 className="font-semibold">{capitalize(formatDate(month, { weekday: undefined, day: undefined, month: "long", year: "numeric" }))}</h2>
        <Link href={nextHref} className="rounded-lg px-3 py-2 text-lg hover:bg-slate-100" aria-label="Następny miesiąc">
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <ol className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => (
          <li
            key={day.date}
            aria-label={`${formatDate(day.date)}: ${describe(day)}`}
            className={`relative flex aspect-square items-start justify-start rounded-lg border border-slate-100 p-1 text-sm tabular-nums ${
              day.inMonth ? "" : "opacity-40"
            } ${day.isToday ? "ring-2 ring-amber-500" : ""}`}
            style={{ background: fill(day) }}
          >
            <span className={day.isToday ? "font-bold" : ""}>{Number(day.date.slice(8))}</span>
          </li>
        ))}
      </ol>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded" style={{ background: BOOKED }} aria-hidden /> Zajęte
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded" style={{ background: fill({ morning: false, evening: true }) }} aria-hidden />
          Zameldowanie
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded" style={{ background: fill({ morning: true, evening: false }) }} aria-hidden />
          Wymeldowanie
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-slate-200 bg-white" aria-hidden /> Wolne
        </li>
      </ul>
    </section>
  );
}

function fill({ morning, evening }: Pick<GridDay, "morning" | "evening">): string {
  if (morning && evening) return BOOKED;
  if (evening) return `linear-gradient(135deg, white 50%, ${BOOKED} 50%)`;
  if (morning) return `linear-gradient(135deg, ${BOOKED} 50%, white 50%)`;
  return "white";
}

function describe({ morning, evening }: GridDay): string {
  if (morning && evening) return "zajęte";
  if (evening) return "dzień zameldowania";
  if (morning) return "dzień wymeldowania";
  return "wolne";
}
