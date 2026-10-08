import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Konto" };

export default async function AccountPage() {
  // Both roles have an account page.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <AppHeader user={user} active="account" />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold">Konto</h1>
        <section aria-label="Hasło" className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 font-medium">Hasło</h2>
          <p className="mb-3 text-sm text-slate-600">
            Ustaw własne hasło, aby logować się emailem ({user.email ?? "brak"}) i hasłem. Logowanie linkiem na email
            nadal działa, także gdy zapomnisz hasła.
          </p>
          <PasswordForm email={user.email} />
        </section>
      </main>
    </>
  );
}
