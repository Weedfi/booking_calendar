import { daysBetween, type DateKey } from "@/lib/dates";

export type ChannelSource = "booking" | "airbnb" | "other";

export type CalendarReservation = {
  id: string;
  propertyId: string;
  source: ChannelSource;
  startDate: DateKey;
  /** Checkout day, exclusive. */
  endDate: DateKey;
  summary: string | null;
};

/**
 * A reservation bar positioned on a grid of half-days, hotel style: a stay
 * starts in the afternoon of check-in and ends in the morning of checkout,
 * so back-to-back stays share a day without overlapping.
 * Day i covers half-columns [2i, 2i + 2).
 */
export type Bar = {
  reservation: CalendarReservation;
  lane: number;
  startHalf: number;
  endHalf: number;
  /** The stay continues before / after the visible range. */
  clippedStart: boolean;
  clippedEnd: boolean;
};

export type PropertyLayout = { bars: Bar[]; laneCount: number };

/**
 * Lays out one property's reservations for a range of `days` starting at
 * `rangeStart`. Overlapping stays (e.g. a double booking across channels)
 * are stacked in separate lanes so none is hidden.
 */
export function layoutProperty(
  reservations: CalendarReservation[],
  rangeStart: DateKey,
  days: number,
): PropertyLayout {
  const totalHalves = days * 2;

  const positioned = reservations
    .map((reservation) => {
      const rawStart = daysBetween(rangeStart, reservation.startDate) * 2 + 1;
      const rawEnd = daysBetween(rangeStart, reservation.endDate) * 2 + 1;
      return {
        reservation,
        startHalf: Math.max(rawStart, 0),
        endHalf: Math.min(rawEnd, totalHalves),
        clippedStart: rawStart < 0,
        clippedEnd: rawEnd > totalHalves,
      };
    })
    .filter((b) => b.endHalf > b.startHalf)
    .sort((a, b) => a.startHalf - b.startHalf || b.endHalf - a.endHalf);

  // Greedy interval partitioning: put each bar in the first free lane.
  const laneEnds: number[] = [];
  const bars = positioned.map((bar): Bar => {
    let lane = laneEnds.findIndex((end) => end <= bar.startHalf);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = bar.endHalf;
    return { ...bar, lane };
  });

  return { bars, laneCount: Math.max(laneEnds.length, 1) };
}
