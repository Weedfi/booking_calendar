"use client";

import { useActionState } from "react";
import { FormMessage, initialActionState, SubmitButton } from "@/components/forms";
import type { ActionState } from "../actions";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  id: string;
  label: string;
  confirmText: string;
};

/** A small delete form that asks for confirmation first. */
export function DeleteButton({ action, id, label, confirmText }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="danger" pendingText="Deleting…">
        {label}
      </SubmitButton>
      {state.status === "error" && <FormMessage state={state} />}
    </form>
  );
}
