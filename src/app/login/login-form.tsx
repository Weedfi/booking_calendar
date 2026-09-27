"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
        Jeśli ten adres ma konto, link do logowania jest już w drodze. Sprawdź skrzynkę.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium text-slate-700">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="ty@przyklad.pl"
        className="rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Wysyłanie…" : "Wyślij link do logowania"}
      </button>
    </form>
  );
}
