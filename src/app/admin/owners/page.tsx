import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { loadOwners } from "@/lib/admin/manage";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./_components/invite-form";
import { SignInEmailButton } from "./_components/sign-in-email-button";
import { deleteOwner } from "../actions";
import { DeleteButton } from "../_components/delete-button";

export const metadata: Metadata = { title: "Właściciele" };

export default async function OwnersPage() {
  const user = await requireRole("admin");
  const owners = await loadOwners(await createClient());

  return (
    <>
      <AppHeader user={user} active="owners" />
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 lg:py-6">
        <h1 className="text-xl font-semibold">Właściciele ({owners.length})</h1>

        <div className="grid items-start gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
          <section
            aria-label="Zaproś właściciela"
            className="@container rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4"
          >
            <h2 className="mb-1 font-medium">Zaproś właściciela</h2>
            <p className="mb-3 text-sm text-slate-600">
              Dostanie zaproszenie, a po jego przyjęciu drugi mail z instrukcją logowania. Potem przypisz mu mieszkania
              na stronie Mieszkania.
            </p>
            <InviteForm />
          </section>

          {owners.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Brak właścicieli.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {owners.map((o) => (
                <li key={o.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {o.name}
                      {o.pending && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
                          Zaproszenie wysłane
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-slate-600">{o.email ?? "Brak emaila"}</p>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
                      Mieszkania ({o.propertyNames.length})
                    </p>
                    {o.propertyNames.length === 0 ? (
                      <p className="text-sm text-slate-500">Brak mieszkań</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {o.propertyNames.map((name) => (
                          <li key={name} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-auto flex flex-wrap items-start justify-between gap-2 border-t border-slate-100 pt-3">
                    {o.email && <SignInEmailButton ownerId={o.id} pending={o.pending} />}
                    <div className="ml-auto">
                      <DeleteButton
                        action={deleteOwner}
                        id={o.id}
                        label="Usuń właściciela"
                        confirmText={deleteConfirmText(o.name, o.propertyNames.length)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

function deleteConfirmText(name: string, properties: number): string {
  const keep =
    properties > 0
      ? ` Przypisane mieszkania (${properties}) i ich rezerwacje zostaną w systemie, bez właściciela.`
      : "";
  return `Usunąć właściciela ${name}? Ta osoba straci dostęp do kalendarza i nie zaloguje się już ani hasłem, ani linkiem.${keep} Tej operacji nie można cofnąć.`;
}
