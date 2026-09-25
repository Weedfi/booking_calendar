"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/actions";

export const initialActionState: ActionState = { status: "idle" };

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 aria-invalid:border-red-500";

export function Field({
  label,
  name,
  state,
  children,
}: {
  label: string;
  name: string;
  state: ActionState;
  children: React.ReactNode;
}) {
  const error = state.fieldErrors?.[name];
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {label}
      {children}
      {error && (
        <span role="alert" className="text-xs font-normal text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}
    >
      {state.message}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
    danger: "text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
