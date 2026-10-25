import type { Metadata } from "next";
import Link from "next/link";
import { inviteSecret, readInviteToken } from "@/lib/invite-token";
import { findUserByEmail } from "@/lib/sign-in-email";
import { acceptInvite } from "./actions";

export const metadata: Metadata = { title: "Zaproszenie" };

/** Landing page of the invitation email. The link never expires; it works until the invitation is accepted. */
export default async function InvitePage({ searchParams }: PageProps<"/invite">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const email = token ? readInviteToken(token, inviteSecret()) : null;
  const user = email ? await findUserByEmail(email) : null;

  let body: React.ReactNode;
  if (!email || !user || params.state === "invalid") {
    body = (
      <Notice title="Ten link zaproszenia jest nieaktualny">
        Mógł zostać skopiowany niedokładnie albo zaproszenie zostało wycofane. Wejdź na stronę logowania, wybierz
        „Link na email” i wpisz swój adres: jeśli masz zaproszenie, wyślemy je ponownie.
      </Notice>
    );
  } else if (user.email_confirmed_at) {
    body = (
      <Notice title="Zaproszenie zostało już przyjęte">
        Twoje konto jest aktywne. Zaloguj się hasłem albo linkiem wysłanym na email.
      </Notice>
    );
  } else {
    const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
    return (
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Witamy{name ? `, ${name}` : ""}!</h1>
        <p className="mt-2 text-sm text-slate-600">
          Zaproszenie do kalendarza rezerwacji Orzechowej Przystani dla adresu <strong>{email}</strong>. Kliknij
          przycisk, aby wejść do kalendarza. Zaraz potem dostaniesz maila z instrukcją logowania.
        </p>
        {params.state === "error" && (
          <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Nie udało się przyjąć zaproszenia. Spróbuj ponownie za chwilę.
          </p>
        )}
        <form action={acceptInvite} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-lg bg-[#2f5233] px-4 py-3 font-medium text-white hover:bg-[#26442a]"
          >
            Przyjmij zaproszenie
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      {body}
      <Link
        href="/login"
        className="mt-6 block rounded-lg bg-slate-900 px-4 py-2 text-center font-medium text-white hover:bg-slate-800"
      >
        Przejdź do logowania
      </Link>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
        <img src="/email/orzechowa-przystan.png" alt="Orzechowa Przystań" width={140} className="mx-auto mb-4" />
        {children}
      </div>
    </main>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{children}</p>
    </>
  );
}
