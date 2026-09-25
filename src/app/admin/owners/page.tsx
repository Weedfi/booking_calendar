import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { loadOwners } from "@/lib/admin/manage";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./_components/invite-form";

export const metadata: Metadata = { title: "Owners" };

export default async function OwnersPage() {
  const user = await requireRole("admin");
  const owners = await loadOwners(await createClient());

  return (
    <>
      <AppHeader user={user} active="owners" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold">Owners ({owners.length})</h1>

        <section aria-label="Invite an owner" className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 font-medium">Invite an owner</h2>
          <p className="mb-3 text-sm text-slate-600">
            They get an email with a sign-in link. Then assign their properties on the Properties page.
          </p>
          <InviteForm />
        </section>

        <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {owners.length === 0 && <li className="p-4 text-sm text-slate-500">No owners yet.</li>}
          {owners.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {o.name}
                  {o.pending && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
                      Invitation pending
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-600">{o.email ?? "No email"}</p>
              </div>
              <p className="ml-auto text-sm text-slate-600">
                {o.propertyNames.length === 0 ? "No properties" : o.propertyNames.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
