import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { occupancy } from "@/lib/calendar/stats";
import type { ChannelSource } from "@/lib/calendar/tape-chart";
import { addDays, daysBetween, isDateKey, monthRange, type DateKey } from "@/lib/dates";
import { monthGrid, monthGridWindow, type GridDay } from "./month-grid";

export type OwnerProperty = { id: string; name: string; address: string | null; color: string };

export type OwnerStay = {
  id: string;
  source: ChannelSource;
  startDate: DateKey;
  endDate: DateKey;
};

export type OwnerParams = { propertyId: string | null; month: DateKey };

type SearchParams = Record<string, string | string[] | undefined>;

/** Reads ?property=<uuid>&month=YYYY-MM. Invalid values fall back to defaults. */
export function parseOwnerParams(params: SearchParams, today: DateKey): OwnerParams {
  const property = typeof params.property === "string" ? params.property : null;
  const month = typeof params.month === "string" ? `${params.month}-01` : "";
  return {
    propertyId: property,
    month: isDateKey(month) ? month : monthRange(today).start,
  };
}

export function monthParam(month: DateKey): string {
  return month.slice(0, 7);
}

export type OwnerView = {
  properties: OwnerProperty[];
  property: OwnerProperty;
  month: DateKey;
  prevMonth: DateKey;
  nextMonth: DateKey;
  weeks: GridDay[][];
  occupancy: number;
  bookedNights: number;
  current: OwnerStay | null;
  upcoming: OwnerStay[];
};

/**
 * Loads everything for one of the owner's properties. Runs as the signed-in
 * owner, so RLS limits it to their own properties whatever the URL says.
 * Returns null if the owner has no properties.
 */
export async function loadOwnerView(
  supabase: SupabaseClient<Database>,
  params: OwnerParams,
  today: DateKey,
): Promise<OwnerView | null> {
  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name, address, color")
    .order("name");
  if (error) throw error;
  if (properties.length === 0) return null;

  const property = properties.find((p) => p.id === params.propertyId) ?? properties[0];
  const window = monthGridWindow(params.month);

  // Query builders are mutable, so each query gets a fresh one.
  const activeStays = () =>
    supabase
      .from("reservations")
      .select("id, source, start_date, end_date")
      .eq("property_id", property.id)
      .eq("status", "active");

  const [inMonth, upcoming] = await Promise.all([
    activeStays().gte("end_date", window.from).lt("start_date", window.to).order("start_date"),
    activeStays().gt("end_date", today).order("start_date").limit(8),
  ]);
  if (inMonth.error) throw inMonth.error;
  if (upcoming.error) throw upcoming.error;

  return buildOwnerView(
    properties,
    property,
    inMonth.data.map(toStay),
    upcoming.data.map(toStay),
    params.month,
    today,
  );
}

export function buildOwnerView(
  properties: OwnerProperty[],
  property: OwnerProperty,
  monthStays: OwnerStay[],
  upcomingStays: OwnerStay[],
  month: DateKey,
  today: DateKey,
): OwnerView {
  const { start, end } = monthRange(month);
  const share = occupancy(monthStays, start, end);
  const current = upcomingStays.find((s) => s.startDate <= today && today < s.endDate) ?? null;

  return {
    properties,
    property,
    month: start,
    prevMonth: monthRange(addDays(start, -1)).start,
    nextMonth: end,
    weeks: monthGrid(monthStays, start, today),
    occupancy: share,
    bookedNights: Math.round(share * daysBetween(start, end)),
    current,
    upcoming: upcomingStays.filter((s) => s !== current),
  };
}

function toStay(r: { id: string; source: ChannelSource; start_date: string; end_date: string }): OwnerStay {
  return { id: r.id, source: r.source, startDate: r.start_date, endDate: r.end_date };
}
