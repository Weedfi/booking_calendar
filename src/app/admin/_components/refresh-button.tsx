"use client";

import { useActionState } from "react";
import { FormMessage, initialActionState, SubmitButton } from "@/components/forms";
import { refreshNow } from "../actions";

/** "Refresh now": syncs every channel, or only one property's channels. */
export function RefreshButton({ propertyId, label = "Refresh now" }: { propertyId?: string; label?: string }) {
  const [state, action] = useActionState(refreshNow, initialActionState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      {propertyId && <input type="hidden" name="id" value={propertyId} />}
      <SubmitButton variant="secondary" pendingText="Syncing…">
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
