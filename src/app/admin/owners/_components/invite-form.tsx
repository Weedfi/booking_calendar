"use client";

import { useActionState } from "react";
import { Field, FormMessage, initialActionState, inputClass, SubmitButton } from "@/components/forms";
import { inviteOwner } from "../../actions";

export function InviteForm() {
  const [state, action] = useActionState(inviteOwner, initialActionState);

  return (
    <form action={action} className="grid gap-3 @2xl:grid-cols-[1fr_1fr_auto] @2xl:items-end">
      <Field label="Imię i nazwisko" name="full_name" state={state}>
        <input
          name="full_name"
          required
          defaultValue={state.values?.full_name ?? ""}
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors?.full_name)}
          className={inputClass}
        />
      </Field>
      <Field label="Email" name="email" state={state}>
        <input
          name="email"
          type="email"
          required
          defaultValue={state.values?.email ?? ""}
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          className={inputClass}
        />
      </Field>
      <SubmitButton pendingText="Wysyłanie…">Wyślij zaproszenie</SubmitButton>
      <div className="@2xl:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
