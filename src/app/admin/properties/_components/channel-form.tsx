"use client";

import { useActionState } from "react";
import { Field, FormMessage, initialActionState, inputClass, SubmitButton } from "@/components/forms";
import { CHANNELS } from "@/lib/calendar/channels";
import { addChannel } from "../../actions";

/**
 * Adds an iCal feed to a property. The URL is write-only: saved URLs are never
 * read back to the browser (only the admin's own input is echoed on an error).
 */
export function ChannelForm({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState(addChannel, initialActionState);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
      <input type="hidden" name="property_id" value={propertyId} />
      <Field label="Channel" name="source" state={state}>
        <select key={state.values?.source} name="source" defaultValue={state.values?.source ?? "booking"} className={inputClass}>
          {Object.entries(CHANNELS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="iCal export link" name="ical_url" state={state}>
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
      <SubmitButton variant="secondary" pendingText="Adding & syncing…">
        Add channel
      </SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
