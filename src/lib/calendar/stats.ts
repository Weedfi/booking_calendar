import { addDays, daysBetween, type DateKey } from "@/lib/dates";
import type { CalendarReservation } from "./tape-chart";

type Stay = Pick<CalendarReservation, "startDate" | "endDate">;

/**
 * Share of nights in [start, end) that are occupied, from 0 to 1.
 * Overlapping stays (double bookings, blocks over bookings) count once.
 */
export function occupancy(stays: Stay[], start: DateKey, end: DateKey): number {
  const total = daysBetween(start, end);
  if (total <= 0) return 0;

  const nights = new Set<DateKey>();
  for (const stay of stays) {
    let night = stay.startDate > start ? stay.startDate : start;
    const last = stay.endDate < end ? stay.endDate : end;
    while (night < last) {
      nights.add(night);
      night = addDays(night, 1);
    }
  }
  return nights.size / total;
}

export type Turnovers<T> = { checkIns: T[]; checkOuts: T[] };

/** Arrivals and departures on a given day (the cleaning plan). */
export function turnovers<T extends Stay>(stays: T[], day: DateKey): Turnovers<T> {
  return {
    checkIns: stays.filter((s) => s.startDate === day),
    checkOuts: stays.filter((s) => s.endDate === day),
  };
}

/** "przed chwilą", "5 min temu", "3 godz. temu", "2 dni temu". */
export function formatRelative(instant: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - instant.getTime()) / 60_000);
  if (minutes < 1) return "przed chwilą";
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "dzień" : "dni"} temu`;
}
