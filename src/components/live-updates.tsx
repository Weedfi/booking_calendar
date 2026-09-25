"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { batchMessages, toNotice, type Notice, type ReservationChange, type ReservationRow } from "@/lib/realtime/notices";
import { createClient } from "@/lib/supabase/client";

type Toast = { id: number; text: string };

/** Changes arriving within this window are shown and refreshed together. */
const BATCH_MS = 800;
const TOAST_MS = 7000;

/**
 * Subscribes to reservation changes over Supabase Realtime. RLS decides which
 * changes this user receives. Each burst shows a toast and re-renders the
 * page from the server, so the calendar updates without a reload.
 */
export function LiveUpdates({ propertyNames }: { propertyNames: Record<string, string> }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Kept in a ref so re-renders with fresh names don't resubscribe.
  const names = useRef(propertyNames);
  useEffect(() => {
    names.current = propertyNames;
  }, [propertyNames]);

  useEffect(() => {
    const supabase = createClient();
    let pending: Notice[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
    let nextId = 0;

    const flush = () => {
      const messages = batchMessages(pending, names.current);
      pending = [];
      if (messages.length > 0) {
        const added = messages.map((text) => ({ id: ++nextId, text }));
        setToasts((current) => [...current, ...added].slice(-4));
        setTimeout(() => setToasts((current) => current.filter((t) => !added.includes(t))), TOAST_MS);
      }
      router.refresh();
    };

    const onChange = (payload: RealtimePostgresChangesPayload<ReservationRow>) => {
      // An authorization error arrives as an event with empty rows.
      if (payload.errors?.length) return;
      const notice = toNotice(payload as unknown as ReservationChange);
      if (notice) pending.push(notice);
      clearTimeout(timer);
      timer = setTimeout(flush, BATCH_MS);
    };

    (async () => {
      // Hand the user's token to Realtime *before* joining; otherwise the join
      // can race the session load and RLS rejects it as anonymous.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        // Unique topic: the browser client is a singleton, and leaving a shared
        // topic (e.g. on a remount) would also drop the other subscription.
        .channel(`reservation-changes-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, onChange)
        // SUBSCRIBED comes before changes actually stream; "Live" waits for
        // the server's "Subscribed to PostgreSQL" system message instead.
        .on("system", {}, (payload: { extension: string; status: string }) => {
          if (payload.extension === "postgres_changes") setLive(payload.status === "ok");
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") setLive(false);
        });
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <>
      <span
        className={`inline-flex items-center gap-1.5 text-xs ${live ? "text-emerald-700" : "text-slate-400"}`}
        title={live ? "Changes appear here as soon as they are synced" : "Connecting to live updates…"}
      >
        <span className={`size-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
        {live ? "Live" : "Connecting…"}
      </span>
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
          >
            {toast.text}
          </div>
        ))}
      </div>
    </>
  );
}
