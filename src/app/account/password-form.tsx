"use client";

import { useActionState } from "react";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { setPassword, type PasswordState } from "./actions";

const initialState: PasswordState = { status: "idle" };

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

export function PasswordForm({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState(setPassword, initialState);

  return (
    // The key clears the fields after a successful save.
    <form key={state.status === "saved" ? "saved" : "form"} action={formAction} className="flex flex-col gap-3">
      {/* Lets password managers store the new password under the right account. */}
      <input type="email" name="username" value={email ?? ""} autoComplete="username" readOnly hidden />
      <label htmlFor="password" className="text-sm font-medium text-slate-700">
        Nowe hasło
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        autoComplete="new-password"
        aria-describedby="password-hint"
        className={inputClass}
      />
      <p id="password-hint" className="text-xs text-slate-500">
        Co najmniej {PASSWORD_MIN_LENGTH} znaków.
      </p>
      <label htmlFor="confirmation" className="text-sm font-medium text-slate-700">
        Powtórz hasło
      </label>
      <input
        id="confirmation"
        name="confirmation"
        type="password"
        required
        autoComplete="new-password"
        className={inputClass}
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Zapisywanie…" : "Zapisz hasło"}
      </button>
    </form>
  );
}
