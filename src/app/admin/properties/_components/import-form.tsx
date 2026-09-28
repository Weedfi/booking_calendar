"use client";

import { useActionState } from "react";
import { FormMessage, initialActionState, SubmitButton } from "@/components/forms";
import { importHistory } from "../../actions";

/**
 * Uploads the reservation list exported from the Booking.com extranet, to
 * fill in stays from before the first iCal sync. The file is read on the
 * server and discarded; only rooms and dates are kept.
 */
export function ImportForm() {
  const [state, action] = useActionState(importHistory, initialActionState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>
          W extranecie Booking.com otwórz <strong>Rezerwacje</strong>, wybierz zakres dat (np. ostatni rok) i kliknij{" "}
          <strong>Pobierz</strong>.
        </li>
        <li>Wybierz pobrany plik poniżej. Jeśli to plik Excel, zapisz go najpierw jako CSV (Plik → Zapisz jako → CSV UTF-8).</li>
      </ol>
      <p className="text-xs text-slate-500">
        Importowane są tylko zakończone, nieanulowane pobyty: pokój i daty. Imiona gości, ceny i dane kontaktowe z pliku są
        pomijane i nie trafiają do bazy. Ponowny import tego samego pliku nie tworzy duplikatów.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          required
          accept=".csv,.txt,.tsv,.xls,.htm,.html"
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-100"
        />
        <SubmitButton variant="secondary" pendingText="Importowanie…">
          Importuj historię
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
