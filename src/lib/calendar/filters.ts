import { addDays, isDateKey, startOfWeek, type DateKey } from "@/lib/dates";
import type { ChannelSource } from "./tape-chart";

export const RANGE_OPTIONS = [7, 14, 31] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];
const DEFAULT_DAYS: RangeDays = 14;

const SOURCES: ChannelSource[] = ["booking", "airbnb", "other"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminFilters = {
  ownerId: string | null;
  propertyId: string | null;
  source: ChannelSource | null;
  /** First visible day of the tape chart. */
  from: DateKey;
  days: RangeDays;
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Reads filters from the URL. Anything malformed falls back to the default. */
export function parseAdminFilters(params: SearchParams, today: DateKey): AdminFilters {
  const get = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };

  const owner = get("owner");
  const property = get("property");
  const source = get("channel");
  const from = get("from");
  const days = Number(get("days"));

  return {
    ownerId: owner && UUID.test(owner) ? owner : null,
    propertyId: property && UUID.test(property) ? property : null,
    source: SOURCES.includes(source as ChannelSource) ? (source as ChannelSource) : null,
    from: from && isDateKey(from) ? from : defaultFrom(today),
    days: RANGE_OPTIONS.includes(days as RangeDays) ? (days as RangeDays) : DEFAULT_DAYS,
  };
}

/** Builds a query string for the filters, leaving out defaults. */
export function filtersToQuery(filters: AdminFilters, today: DateKey): string {
  const params = new URLSearchParams();
  if (filters.ownerId) params.set("owner", filters.ownerId);
  if (filters.propertyId) params.set("property", filters.propertyId);
  if (filters.source) params.set("channel", filters.source);
  if (filters.from !== defaultFrom(today)) params.set("from", filters.from);
  if (filters.days !== DEFAULT_DAYS) params.set("days", String(filters.days));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Start the chart on this week's Monday, so recent check-outs are visible. */
export function defaultFrom(today: DateKey): DateKey {
  return startOfWeek(today);
}

export function rangeEnd(filters: AdminFilters): DateKey {
  return addDays(filters.from, filters.days);
}
