"use client";

import { useActionState } from "react";
import { Field, FormMessage, initialActionState, inputClass, SubmitButton } from "@/components/forms";
import { updateChannelUrl } from "../../actions";

/** Replaces a channel's export link without losing its stays. Write-only, like adding one. */
export function ChannelUrlForm({ channelId }: { channelId: string }) {
  const [state, action] = useActionState(updateChannelUrl, initialActionState);

  return (
    <details className="w-full">
      <summary className="cursor-pointer text-xs text-slate-600 underline hover:text-slate-900">Zmień link</summary>
      <form action={action} className="mt-2 grid gap-2 @md:grid-cols-[1fr_auto] @md:items-end">
        <input type="hidden" name="id" value={channelId} />
        <Field label="Nowy link eksportu iCal" name="ical_url" state={state}>
          <input
            name="ical_url"
            type="url"
            required
            autoComplete="off"
            defaultValue={state.values?.ical_url ?? ""}
            placeholder="https://ical.booking.com/v1/export?t=…"
            aria-invalid={Boolean(state.fieldErrors?.ical_url)}
            className={inputClass}
          />
        </Field>
        <SubmitButton variant="secondary" pendingText="Zapisywanie i synchronizacja…">
          Zapisz link
        </SubmitButton>
        <div className="@md:col-span-2">
          <FormMessage state={state} />
        </div>
      </form>
    </details>
  );
}
