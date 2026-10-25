"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { daysBetween, formatDate } from "@/lib/dates";
import { nightsLabel } from "@/lib/i18n";
import { inspectChannel, type InspectState } from "../../actions";

const initial: InspectState = { status: "idle" };

/** "Sprawdź feed": what the channel's calendar export says right now, next to what the app shows. */
export function FeedInspector({ channelId }: { channelId: string }) {
  const [state, action] = useActionState(inspectChannel, initial);

  return (
    <div className="w-full">
      <form action={action}>
        <input type="hidden" name="id" value={channelId} />
        <CheckButton />
      </form>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {state.message}
        </p>
      )}
      {state.status === "done" && <Result state={state} />}
    </div>
  );
}

function CheckButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-xs text-slate-600 underline hover:text-slate-900 disabled:opacity-60">
      {pending ? "Sprawdzanie…" : "Sprawdź feed"}
    </button>
  );
}

function Result({ state }: { state: Extract<InspectState, { status: "done" }> }) {
  const time = new Date(state.checkedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const missing = state.rows.filter((r) => r.inFeed && !r.inApp).length;
  const inFeed = state.rows.filter((r) => r.inFeed).length;

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p>
        Sprawdzono o {time}. Kalendarz wysyła teraz <strong>{inFeed}</strong>{" "}
        {inFeed === 1 ? "zajęty termin" : "zajętych terminów"} od dziś.
      </p>
      {state.rows.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-slate-200">
          {state.rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
              <span className="font-medium tabular-nums">
                {formatDate(r.startDate)} → {formatDate(r.endDate)}
              </span>
              <span className="text-slate-500">{nightsLabel(daysBetween(r.startDate, r.endDate))}</span>
              {r.summary && <span className="text-slate-500">„{r.summary}”</span>}
              <Badge inFeed={r.inFeed} inApp={r.inApp} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-slate-500">
        W pliku z kalendarza: {state.feed.events} {state.feed.events === 1 ? "wydarzenie" : "wydarzeń"}
        {state.feed.past > 0 && `, w tym ${state.feed.past} z przeszłości`}
        {state.feed.skipped > 0 && `, ${state.feed.skipped} pominiętych (bez daty lub anulowanych)`}.
      </p>
      {state.feed.events === 0 && state.feed.skipped === 0 && (
        <p className="mt-2 rounded bg-amber-50 p-2 text-amber-900">
          Booking.com wysyła pusty kalendarz: dla tego linku nie ma żadnych rezerwacji ani zablokowanych dni. Sprawdź
          w extranecie, czy link eksportu pochodzi z tego samego pokoju, w którym blokujesz noce, i czy noce są
          zamknięte dla całego pokoju (0 pokoi do sprzedaży).
        </p>
      )}
      <p className="mt-2 text-slate-500">
        {missing > 0
          ? "Część terminów jest już w kalendarzu Bookingu, ale jeszcze nie w aplikacji: kliknij „Synchronizuj to mieszkanie”."
          : "Jeśli zablokowanych nocy nie ma na tej liście, Booking.com jeszcze ich nie udostępnia w eksporcie kalendarza. Sprawdź ponownie za kilkanaście minut."}
      </p>
    </div>
  );
}

function Badge({ inFeed, inApp }: { inFeed: boolean; inApp: boolean }) {
  const [label, style] =
    inFeed && inApp
      ? ["W aplikacji", "bg-emerald-100 text-emerald-800"]
      : inFeed
        ? ["Jeszcze nie w aplikacji", "bg-amber-100 text-amber-900"]
        : ["Już nie ma w kalendarzu", "bg-slate-200 text-slate-700"];
  return <span className={`ml-auto rounded px-1.5 py-0.5 ${style}`}>{label}</span>;
}
