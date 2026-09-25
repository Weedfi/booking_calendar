import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homePath } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { demoSignIn } from "./actions";
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
        {error === "demo" && (
          <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            The demo sign-in did not work. Try again in a moment.
          </p>
        )}
        {isDemoMode() && <DemoSignIn />}
        <LoginForm />
      </div>
    </main>
  );
}

function DemoSignIn() {
  const button = "flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100";
  return (
    <div className="mb-6 rounded-xl bg-indigo-50 p-4">
      <p className="mb-3 text-sm text-indigo-950">
        <span className="font-semibold">Public demo with fake data.</span> Look around as:
      </p>
      <div className="flex gap-2">
        <form action={demoSignIn} className="flex flex-1">
          <input type="hidden" name="account" value="admin" />
          <button type="submit" className={button}>Manager (admin)</button>
        </form>
        <form action={demoSignIn} className="flex flex-1">
          <input type="hidden" name="account" value="owner" />
          <button type="submit" className={button}>Owner</button>
        </form>
      </div>
    </div>
  );
}
