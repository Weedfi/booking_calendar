"use client";

import { useActionState } from "react";
import { Field, FormMessage, initialActionState, inputClass, SubmitButton } from "@/components/forms";
import { updateOwner } from "../../actions";

export type PropertyChoice = { id: string; name: string; color: string; ownerId: string | null; ownerName: string | null };

type Props = {
  owner: { id: string; name: string; email: string | null };
  properties: PropertyChoice[];
};

/** Name, sign-in email and owned properties of one owner. */
export function OwnerEditForm({ owner, properties }: Props) {
  const [state, action] = useActionState(updateOwner, initialActionState);
  const value = (key: string, fallback: string) => state.values?.[key] ?? fallback;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={owner.id} />
      <Field label="Imię i nazwisko" name="full_name" state={state}>
        <input
          name="full_name"
          required
          defaultValue={value("full_name", owner.name)}
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors?.full_name)}
          className={inputClass}
        />
      </Field>
      <Field label="Email do logowania" name="email" state={state}>
        <input
          name="email"
          type="email"
          required
          defaultValue={value("email", owner.email ?? "")}
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          className={inputClass}
        />
      </Field>
      <p className="-mt-1 text-xs text-slate-500">
        Nowy adres działa od razu: od teraz właściciel loguje się nim, a stary przestaje działać.
      </p>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium text-slate-700">Mieszkania</legend>
        {properties.length === 0 && <p className="text-sm text-slate-500">Brak mieszkań w systemie.</p>}
        {properties.map((p) => {
          const elsewhere = p.ownerId !== null && p.ownerId !== owner.id;
          return (
            <label key={p.id} className="flex items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                name="property_ids"
                value={p.id}
                defaultChecked={p.ownerId === owner.id}
                className="mt-0.5 size-4 accent-slate-900"
              />
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
              <span>
                {p.name}
                {elsewhere && (
                  <span className="block text-xs text-amber-700">Teraz: {p.ownerName}. Zaznaczenie przeniesie mieszkanie.</span>
                )}
              </span>
            </label>
          );
        })}
        {state.fieldErrors?.property_ids && (
          <span role="alert" className="text-xs text-red-700">
            {state.fieldErrors.property_ids}
          </span>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Zapisywanie…">Zapisz zmiany</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
