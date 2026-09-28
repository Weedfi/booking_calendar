"use client";

import { useActionState, useEffect, useRef, type CSSProperties } from "react";
import { Field, FormMessage, initialActionState, inputClass, SubmitButton } from "@/components/forms";
import { saveGuestName } from "../actions";

type Props = {
  style: CSSProperties;
  className: string;
  label: string;
  description: string;
  stay: { propertyId: string; startDate: string; endDate: string; title: string };
  guestName: string;
};

/**
 * A reservation bar on the tape chart. Clicking it opens a small dialog to
 * enter or change the guest's name for this stay.
 */
export function ReservationBar({ style, className, label, description, stay, guestName }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(saveGuestName, initialActionState);

  // Close after a successful save; the page refreshes with the new name.
  useEffect(() => {
    if (state.status === "success") dialog.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        aria-label={`${description}. Kliknij, aby wpisać gościa.`}
        title={description}
        className={`${className} cursor-pointer text-left hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900`}
        style={style}
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/40"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <form action={action} className="flex flex-col gap-3 p-5">
          <h2 className="font-semibold">Gość</h2>
          <p className="text-sm text-slate-600">{stay.title}</p>
          <input type="hidden" name="property_id" value={stay.propertyId} />
          <input type="hidden" name="start_date" value={stay.startDate} />
          <input type="hidden" name="end_date" value={stay.endDate} />
          <Field label="Imię i nazwisko" name="guest_name" state={state}>
            <input
              name="guest_name"
              defaultValue={state.values?.guest_name ?? guestName}
              autoComplete="off"
              placeholder="np. Jan Kowalski"
              className={inputClass}
            />
          </Field>
          <p className="text-xs text-slate-500">Widoczne dla Ciebie i właściciela tego pokoju. Puste pole usuwa gościa.</p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => dialog.current?.close()}
            >
              Anuluj
            </button>
            <SubmitButton pendingText="Zapisywanie…">Zapisz</SubmitButton>
          </div>
          <FormMessage state={state} />
        </form>
      </dialog>
    </>
  );
}
