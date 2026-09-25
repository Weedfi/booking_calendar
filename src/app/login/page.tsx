import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homePath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(homePath(user.role));

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Rental Calendar</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">
          Sign in with your email. We&apos;ll send you a link, no password needed.
        </p>
        {error === "link" && (
          <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            That sign-in link is invalid or has expired. Request a new one.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
