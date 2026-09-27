import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";

type Section = "calendar" | "properties" | "owners";

const ADMIN_NAV: { section: Section; href: string; label: string }[] = [
  { section: "calendar", href: "/admin", label: "Kalendarz" },
  { section: "properties", href: "/admin/properties", label: "Mieszkania" },
  { section: "owners", href: "/admin/owners", label: "Właściciele" },
];

export function AppHeader({ user, active }: { user: CurrentUser; active?: Section }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      {isDemoMode() && (
        <p className="bg-indigo-600 px-4 py-1 text-center text-xs text-white">
          Publiczne demo z fałszywymi danymi. Zmiany są wyłączone; synchronizacja i aktualizacje na żywo działają.
        </p>
      )}
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            Kalendarz rezerwacji
            {user.role === "admin" && (
              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-medium text-white">Admin</span>
            )}
          </Link>
          {user.role === "admin" && (
            <nav aria-label="Panel admina" className="flex gap-1 text-sm">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.section}
                  href={item.href}
                  aria-current={item.section === active ? "page" : undefined}
                  className={`rounded-md px-2 py-1 ${
                    item.section === active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">{user.fullName ?? user.email}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">
              Wyloguj
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
