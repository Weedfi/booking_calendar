import { formatDate } from "@/lib/dates";

/** The reservation columns a Realtime change carries (a subset is enough). */
export type ReservationRow = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  status: "active" | "cancelled";
};

export type ReservationChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Partial<ReservationRow>;
  /** With RLS enabled, Realtime only includes the primary key here. */
  old: Partial<ReservationRow>;
};

export type Notice = {
  kind: "new" | "cancelled" | "updated";
  propertyId: string;
  startDate: string;
  endDate: string;
};

/**
 * Turns a Realtime change into something worth telling the user, or null.
 * Only the new row is reliable, so the kind is read from it: the sync only
 * ever cancels active rows, and only writes rows that actually changed.
 */
export function toNotice(change: ReservationChange): Notice | null {
  const row = change.new;
  if (!row.property_id || !row.start_date || !row.end_date || !row.status) return null;
  const base = { propertyId: row.property_id, startDate: row.start_date, endDate: row.end_date };

  if (change.eventType === "INSERT") return row.status === "active" ? { kind: "new", ...base } : null;
  if (change.eventType === "UPDATE") return { kind: row.status === "cancelled" ? "cancelled" : "updated", ...base };
  return null;
}

const LABELS: Record<Notice["kind"], string> = {
  new: "New booking",
  cancelled: "Cancelled",
  updated: "Booking updated",
};

/** "New booking: Old Town Loft, Fri 9 Oct → Mon 12 Oct" */
export function noticeText(notice: Notice, propertyName: string | undefined): string {
  const dates = `${formatDate(notice.startDate)} → ${formatDate(notice.endDate)}`;
  return `${LABELS[notice.kind]}: ${propertyName ?? "a property"}, ${dates}`;
}

/**
 * Messages for a burst of notices. A first sync can insert dozens of rows at
 * once; beyond a few, one summary line beats a wall of toasts.
 */
export function batchMessages(notices: Notice[], names: Record<string, string>, max = 3): string[] {
  if (notices.length <= max) return notices.map((n) => noticeText(n, names[n.propertyId]));
  const properties = new Set(notices.map((n) => n.propertyId)).size;
  return [`${notices.length} booking updates across ${properties} ${properties === 1 ? "property" : "properties"}`];
}
