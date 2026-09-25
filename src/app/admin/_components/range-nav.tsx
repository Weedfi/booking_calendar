import Link from "next/link";
import { defaultFrom, filtersToQuery, rangeEnd, type AdminFilters } from "@/lib/calendar/filters";
import { addDays, formatDate, type DateKey } from "@/lib/dates";

/** Moves the visible range by a week or a month (4 weeks, so it stays on Mondays). */
export function RangeNav({ filters, today }: { filters: AdminFilters; today: DateKey }) {
  const href = (from: DateKey) => `/admin${filtersToQuery({ ...filters, from }, today)}`;
  const link = "rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-100";
  const last = addDays(rangeEnd(filters), -1);

  return (
    <nav aria-label="Date range" className="flex flex-wrap items-center gap-1">
      <Link href={href(addDays(filters.from, -28))} className={link} aria-label="Back one month">
        «
      </Link>
      <Link href={href(addDays(filters.from, -7))} className={link} aria-label="Back one week">
        ‹ Week
      </Link>
      <Link href={href(defaultFrom(today))} className={`${link} font-medium`}>
        Today
      </Link>
      <Link href={href(addDays(filters.from, 7))} className={link} aria-label="Forward one week">
        Week ›
      </Link>
      <Link href={href(addDays(filters.from, 28))} className={link} aria-label="Forward one month">
        »
      </Link>
      <span className="ml-2 text-sm text-slate-600">
        {formatDate(filters.from, { weekday: undefined })} – {formatDate(last, { weekday: undefined, year: "numeric" })}
      </span>
    </nav>
  );
}
