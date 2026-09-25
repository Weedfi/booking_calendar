import { addDays, daysBetween, monthRange, startOfWeek, type DateKey } from "@/lib/dates";

type Stay = { startDate: DateKey; endDate: DateKey };

export type GridDay = {
  date: DateKey;
  inMonth: boolean;
  isToday: boolean;
  /** Night before this day is booked, so the morning is taken (a guest checks out or stays on). */
  morning: boolean;
  /** Night starting this day is booked, so the afternoon is taken (a guest checks in or stays on). */
  evening: boolean;
};

/**
 * A Monday-first month calendar, padded with days of the adjacent months
 * to whole weeks. Each day is split into morning and evening, so check-in
 * and checkout days show as half-booked, like a hotel calendar.
 */
export function monthGrid(stays: Stay[], month: DateKey, today: DateKey): GridDay[][] {
  const { start, end } = monthRange(month);
  const gridStart = startOfWeek(start);
  const gridEnd = addDays(startOfWeek(addDays(end, -1)), 7);

  const bookedNights = new Set<DateKey>();
  for (const stay of stays) {
    for (let night = stay.startDate; night < stay.endDate; night = addDays(night, 1)) {
      bookedNights.add(night);
    }
  }

  const weeks: GridDay[][] = [];
  const count = daysBetween(gridStart, gridEnd);
  for (let i = 0; i < count; i++) {
    const date = addDays(gridStart, i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      date,
      inMonth: date >= start && date < end,
      isToday: date === today,
      morning: bookedNights.has(addDays(date, -1)),
      evening: bookedNights.has(date),
    });
  }
  return weeks;
}

/** Date range the grid covers, including the night before its first day. */
export function monthGridWindow(month: DateKey): { from: DateKey; to: DateKey } {
  const { start, end } = monthRange(month);
  return {
    from: addDays(startOfWeek(start), -1),
    to: addDays(startOfWeek(addDays(end, -1)), 7),
  };
}
