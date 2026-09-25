import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          Rental Calendar
          {user.role === "admin" && (
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-medium text-white">Admin</span>
          )}
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">{user.fullName ?? user.email}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
