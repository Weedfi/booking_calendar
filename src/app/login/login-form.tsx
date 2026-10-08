"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, signInWithPassword, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
const buttonClass = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60";

type Mode = "password" | "link";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("password");

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Sposób logowania" className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
        <ModeTab mode="password" current={mode} onSelect={setMode} label="Hasło" />
        <ModeTab mode="link" current={mode} onSelect={setMode} label="Link na email" />
      </div>
      {/* The key resets the form state when switching modes. */}
      {mode === "password" ? <PasswordForm key="password" /> : <MagicLinkForm key="link" />}
    </div>
  );
}

function ModeTab({
  mode,
  current,
  onSelect,
  label,
}: {
  mode: Mode;
  current: Mode;
  onSelect: (mode: Mode) => void;
  label: string;
}) {
  const selected = mode === current;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(mode)}
      className={`rounded-md px-3 py-1.5 font-medium ${selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
    >
      {label}
    </button>
  );
}

function EmailField() {
  return (
    <>
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
        className={inputClass}
      />
    </>
  );
}

function ErrorMessage({ state }: { state: LoginState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="text-sm text-red-700">
      {state.message}
    </p>
  );
}

function PasswordForm() {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <EmailField />
      <label htmlFor="password" className="text-sm font-medium text-slate-700">
        Hasło
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        className={inputClass}
      />
      <ErrorMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Logowanie…" : "Zaloguj się"}
      </button>
      <p className="text-xs text-slate-500">
        Nie masz hasła albo go nie pamiętasz? Zaloguj się linkiem na email i ustaw hasło w zakładce Konto.
      </p>
    </form>
  );
}

function MagicLinkForm() {
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
      <EmailField />
      <ErrorMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Wysyłanie…" : "Wyślij link do logowania"}
      </button>
    </form>
  );
}
