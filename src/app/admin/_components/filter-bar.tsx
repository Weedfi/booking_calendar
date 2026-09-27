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
        Właściciel
        <select name="owner" defaultValue={filters.ownerId ?? ""} className={select}>
          <option value="">Wszyscy właściciele</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Mieszkanie
        <select name="property" defaultValue={filters.propertyId ?? ""} className={select}>
          <option value="">Wszystkie mieszkania</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Kanał
        <select name="channel" defaultValue={filters.source ?? ""} className={select}>
          <option value="">Wszystkie kanały</option>
          {Object.entries(CHANNELS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {/* The range only affects the tape chart, which is hidden on phones. */}
      <label className="hidden flex-col gap-1 text-xs font-medium text-slate-600 md:flex">
        Zakres
        <select name="days" defaultValue={String(filters.days)} className={select}>
          {RANGE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 7 ? "1 tydzień" : d === 14 ? "2 tygodnie" : "1 miesiąc"}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">
          Zastosuj
        </button>
      </noscript>
    </form>
  );
}
