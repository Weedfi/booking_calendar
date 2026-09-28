import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { rangeEnd, type AdminFilters } from "@/lib/calendar/filters";
import { openOccupancy, splitClosures } from "@/lib/calendar/closures";
import { formatRelative, turnovers } from "@/lib/calendar/stats";
import {
  layoutProperty,
  type CalendarReservation,
  type ChannelSource,
  type Bar,
  type PropertyLayout,
} from "@/lib/calendar/tape-chart";
import { addDays, daysBetween, eachDay, maxDate, minDate, monthRange, type DateKey } from "@/lib/dates";
import { withGuests, type GuestStay } from "@/lib/guests";

export type PropertyRecord = {
  id: string;
  name: string;
  color: string;
  ownerId: string | null;
  ownerName: string | null;
};

/** Channel sync state. Deliberately has no iCal URL. */
export type ChannelStatus = {
  id: string;
  propertyId: string;
  source: ChannelSource;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export type DashboardData = {
  properties: PropertyRecord[];
  owners: { id: string; name: string }[];
  channels: ChannelStatus[];
  reservations: CalendarReservation[];
  /** Guest names for stays in the window; optional so tests can leave it out. */
  guests?: GuestStay[];
};

export type StayWithProperty = { reservation: CalendarReservation; property: PropertyRecord };

export type SyncSummary =
  | { state: "ok"; label: string }
  | { state: "error"; label: string; errors: string[] }
  | { state: "never"; label: string };

export type DashboardRow = {
  property: PropertyRecord;
  layout: PropertyLayout;
  /** Periods closed for sale, drawn behind the stays. */
  closures: Bar[];
  /** Share of open nights booked this month; null if the month is fully closed. */
  occupancy: number | null;
  sync: SyncSummary;
};

export type Dashboard = {
  filters: AdminFilters;
  owners: { id: string; name: string }[];
  propertyOptions: PropertyRecord[];
  days: DateKey[];
  today: DateKey;
  occupancyMonth: { start: DateKey; end: DateKey };
  rows: DashboardRow[];
  turnovers: { day: DateKey; checkIns: StayWithProperty[]; checkOuts: StayWithProperty[] }[];
};

/** Turns raw rows into everything the admin page renders. Pure, so it is unit tested. */
export function buildDashboard(
  data: DashboardData,
  requested: AdminFilters,
  today: DateKey,
  now: Date,
): Dashboard {
  const propertyOptions = data.properties.filter(
    (p) => !requested.ownerId || p.ownerId === requested.ownerId,
  );
  // A property filter that doesn't belong to the chosen owner is dropped.
  const filters: AdminFilters = {
    ...requested,
    propertyId: propertyOptions.some((p) => p.id === requested.propertyId) ? requested.propertyId : null,
  };

  const visible = propertyOptions.filter((p) => !filters.propertyId || p.id === filters.propertyId);
  const visibleIds = new Set(visible.map((p) => p.id));
  const bySource = <T extends { source: ChannelSource }>(x: T) => !filters.source || x.source === filters.source;

  // Closed-for-sale blocks are not stays: kept apart from occupancy and turnovers.
  const { stays: reservations, closures } = splitClosures(
    withGuests(data.reservations, data.guests ?? []).filter((r) => visibleIds.has(r.propertyId) && bySource(r)),
  );
  const channels = data.channels.filter((c) => visibleIds.has(c.propertyId) && bySource(c));
  const propertyById = new Map(visible.map((p) => [p.id, p]));

  const occupancyMonth = monthRange(addDays(filters.from, Math.floor(filters.days / 2)));

  const rows = visible.map((property): DashboardRow => {
    const own = reservations.filter((r) => r.propertyId === property.id);
    const closed = closures.filter((r) => r.propertyId === property.id);
    return {
      property,
      layout: layoutProperty(own, filters.from, filters.days),
      closures: layoutProperty(closed, filters.from, filters.days).bars,
      occupancy: openOccupancy(own, closed, occupancyMonth.start, occupancyMonth.end),
      sync: summarizeSync(channels.filter((c) => c.propertyId === property.id), now),
    };
  });

  const withProperty = (r: CalendarReservation) => ({ reservation: r, property: propertyById.get(r.propertyId)! });
  const byPropertyName = (a: StayWithProperty, b: StayWithProperty) => a.property.name.localeCompare(b.property.name);

  return {
    filters,
    owners: data.owners,
    propertyOptions,
    days: eachDay(filters.from, filters.days),
    today,
    occupancyMonth,
    rows,
    // Today plus the next 6 days; the desktop panel shows the first two.
    turnovers: eachDay(today, 7).map((day) => {
      const t = turnovers(reservations, day);
      return {
        day,
        checkIns: t.checkIns.map(withProperty).sort(byPropertyName),
        checkOuts: t.checkOuts.map(withProperty).sort(byPropertyName),
      };
    }),
  };
}

function summarizeSync(channels: ChannelStatus[], now: Date): SyncSummary {
  const errors = channels.flatMap((c) => (c.lastSyncError ? [`${c.source}: ${c.lastSyncError}`] : []));
  const synced = channels.map((c) => c.lastSyncedAt).filter((t): t is string => t !== null);

  // The oldest channel sync is the honest "last synced" for a property.
  const oldest = synced.length === channels.length && synced.length > 0 ? synced.sort()[0] : null;
  const label = oldest ? `Sync. ${formatRelative(new Date(oldest), now)}` : "Nigdy nie synchronizowano";

  if (errors.length > 0) return { state: "error", label, errors };
  if (!oldest) return { state: "never", label };
  return { state: "ok", label };
}

/** Loads the rows needed for the dashboard, as the signed-in admin (RLS applies). */
export async function loadDashboardData(
  supabase: SupabaseClient<Database>,
  filters: AdminFilters,
  today: DateKey,
): Promise<DashboardData> {
  // One window covering the chart, the occupancy month and the next 7 days.
  const month = monthRange(addDays(filters.from, Math.floor(filters.days / 2)));
  const windowStart = minDate(filters.from, month.start, today);
  const windowEnd = maxDate(rangeEnd(filters), month.end, addDays(today, 8));

  const [properties, owners, channels, reservations] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, color, owner_id, owner:profiles!properties_owner_id_fkey(full_name)")
      .order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "owner").order("full_name"),
    // Never select ical_url here: it is not needed and must not reach the page.
    supabase.from("channels").select("id, property_id, source, last_synced_at, last_sync_error"),
    supabase
      .from("reservations")
      .select("id, property_id, source, start_date, end_date, summary")
      .eq("status", "active")
      .lt("start_date", windowEnd)
      .gt("end_date", windowStart)
      .order("start_date"),
  ]);

  for (const result of [properties, owners, channels, reservations]) {
    if (result.error) throw result.error;
  }

  // Guest names inside the loaded reservations (which may start before the window).
  const loaded = reservations.data!;
  const guests = loaded.length
    ? await supabase
        .from("guest_stays")
        .select("property_id, start_date, end_date, guest_name, source")
        .gte("start_date", minDate(...loaded.map((r) => r.start_date)))
        .lte("end_date", maxDate(...loaded.map((r) => r.end_date)))
    : { data: [], error: null };
  if (guests.error) throw guests.error;

  return {
    properties: properties.data!.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      ownerId: p.owner_id,
      ownerName: p.owner?.full_name ?? null,
    })),
    owners: owners.data!.map((o) => ({ id: o.id, name: o.full_name ?? "Właściciel bez nazwy" })),
    channels: channels.data!.map((c) => ({
      id: c.id,
      propertyId: c.property_id,
      source: c.source,
      lastSyncedAt: c.last_synced_at,
      lastSyncError: c.last_sync_error,
    })),
    reservations: reservations.data!.map((r) => ({
      id: r.id,
      propertyId: r.property_id,
      source: r.source,
      startDate: r.start_date,
      endDate: r.end_date,
      summary: r.summary,
    })),
    guests: guests.data!.map((g) => ({
      propertyId: g.property_id,
      startDate: g.start_date,
      endDate: g.end_date,
      guestName: g.guest_name,
      source: g.source,
    })),
  };
}

export function nights(r: Pick<CalendarReservation, "startDate" | "endDate">): number {
  return daysBetween(r.startDate, r.endDate);
}
