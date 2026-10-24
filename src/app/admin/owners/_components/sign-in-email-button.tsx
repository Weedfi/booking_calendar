"use client";

import { useActionState } from "react";
import { FormMessage, initialActionState, SubmitButton } from "@/components/forms";
import { sendOwnerSignInEmail } from "../../actions";

/** Sends one owner the sign-in guide (or the invitation again, if unopened). */
export function SignInEmailButton({ ownerId, pending }: { ownerId: string; pending: boolean }) {
  const [state, action] = useActionState(sendOwnerSignInEmail, initialActionState);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={ownerId} />
      <SubmitButton variant="secondary" pendingText="Wysyłanie…">
        {pending ? "Wyślij zaproszenie ponownie" : "Wyślij instrukcję logowania"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
