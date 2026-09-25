"use client";

import { usePathname, useRouter } from "next/navigation";
import type { PropertyRecord } from "@/lib/admin/dashboard";
import { CHANNELS } from "@/lib/calendar/channels";
import { RANGE_OPTIONS, type AdminFilters } from "@/lib/calendar/filters";

type Props = {
  filters: AdminFilters;
  owners: { id: string; name: string }[];
  properties: PropertyRecord[];
};

/**
 * A plain GET form, so filters live in the URL (shareable, back button works).
 * JavaScript only adds apply-on-change; without it the Apply button is used.
 * Selects are uncontrolled and keyed by the current filters, so they reset
 * when the server normalizes a value (e.g. drops a property of another owner).
 */
export function FilterBar({ filters, owners, properties }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const select = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3"
      onChange={(e) => {
        // Navigate with a clean URL: no empty "owner=&property=" parameters.
        const params = new URLSearchParams();
        for (const [key, value] of new FormData(e.currentTarget)) {
          if (typeof value === "string" && value) params.set(key, value);
        }
        router.push(`${pathname}?${params}`);
      }}
    >
      <input type="hidden" name="from" value={filters.from} />
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Owner
        <select name="owner" defaultValue={filters.ownerId ?? ""} className={select}>
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Property
        <select name="property" defaultValue={filters.propertyId ?? ""} className={select}>
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Channel
        <select name="channel" defaultValue={filters.source ?? ""} className={select}>
          <option value="">All channels</option>
          {Object.entries(CHANNELS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {/* The range only affects the tape chart, which is hidden on phones. */}
      <label className="hidden flex-col gap-1 text-xs font-medium text-slate-600 md:flex">
        Range
        <select name="days" defaultValue={String(filters.days)} className={select}>
          {RANGE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 7 ? "1 week" : d === 14 ? "2 weeks" : "1 month"}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">
          Apply
        </button>
      </noscript>
    </form>
  );
}
