"use client";

import { useActionState } from "react";
import { Field, FormMessage, initialActionState, inputClass, SubmitButton } from "@/components/forms";
import { saveProperty } from "../../actions";

export type PropertyFormValues = {
  id?: string;
  name: string;
  address: string | null;
  owner_id: string | null;
  color: string;
  booking_property_id: string | null;
  booking_room_name: string | null;
};

type Props = {
  owners: { id: string; name: string }[];
  values?: PropertyFormValues;
};

/** Creates a property, or edits one when `values.id` is set. */
export function PropertyForm({ owners, values }: Props) {
  const [state, action] = useActionState(saveProperty, initialActionState);
  const editing = Boolean(values?.id);
  // After a failed submit, show what was typed instead of the saved values.
  const value = (key: keyof PropertyFormValues) => state.values?.[key] ?? values?.[key] ?? undefined;

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      <Field label="Nazwa" name="name" state={state}>
        <input
          name="name"
          required
          defaultValue={value("name") ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          className={inputClass}
        />
      </Field>
      <Field label="Adres" name="address" state={state}>
        <input name="address" defaultValue={value("address") ?? ""} className={inputClass} />
      </Field>
      <Field label="Właściciel" name="owner_id" state={state}>
        {/* Remount after a failed submit: a select ignores a changed defaultValue. */}
        <select key={state.values?.owner_id} name="owner_id" defaultValue={value("owner_id") ?? ""} className={inputClass}>
          <option value="">Bez właściciela</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Field label="Kolor" name="color" state={state}>
          <input
            name="color"
            type="color"
            defaultValue={value("color") ?? "#3b82f6"}
            className="h-9.5 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
          />
        </Field>
        <Field label="ID obiektu Booking.com" name="booking_property_id" state={state}>
          <input
            name="booking_property_id"
            inputMode="numeric"
            placeholder="np. 1234567"
            defaultValue={value("booking_property_id") ?? ""}
            aria-invalid={Boolean(state.fieldErrors?.booking_property_id)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Nazwa pokoju w Booking.com (opcjonalnie)" name="booking_room_name" state={state}>
        <input
          name="booking_room_name"
          placeholder="np. Marynistyczny Apartament 4-osobowy"
          defaultValue={value("booking_room_name") ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.booking_room_name)}
          className={inputClass}
        />
      </Field>
      <p className="self-end text-xs text-slate-500">
        Kilka apartamentów w jednym obiekcie Booking.com? Wpisz przy każdym ten sam numer obiektu i nazwę pokoju
        taką jak w Booking.com (jeśli różni się od nazwy powyżej). Dzięki temu maile z Booking.com trafią do
        właściwego apartamentu.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingText="Zapisywanie…">{editing ? "Zapisz zmiany" : "Dodaj mieszkanie"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
