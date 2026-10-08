"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS, isDemoMode, type DemoAccount } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) {
    return { status: "error", message: "Podaj poprawny adres email." };
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Invite-only: owners are invited by the admin, nobody can sign up.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error?.status === 429) {
    return { status: "error", message: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie." };
  }
  // Any other outcome, including unknown addresses, gets the same answer so
  // the form cannot be used to check who has an account.
  return { status: "sent" };
}

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!EMAIL.test(email) || password === "") {
    return { status: "error", message: "Podaj email i hasło." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error?.status === 429) {
    return { status: "error", message: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie." };
  }
  if (error) {
    // Same message for an unknown email, a wrong password and an account
    // without a password, so the form does not reveal who has an account.
    return { status: "error", message: "Nieprawidłowy email lub hasło." };
  }
  // "/" routes the user to the admin or owner view based on their role.
  redirect("/");
}

/**
 * Public demo only: one-click sign-in as a seeded demo account. The session
 * is created server side (no email), and only the fixed seed IDs are allowed.
 */
export async function demoSignIn(formData: FormData): Promise<void> {
  const account = String(formData.get("account")) as DemoAccount;
  if (!isDemoMode() || !(account in DEMO_ACCOUNTS)) redirect("/login");

  const { id, email } = DEMO_ACCOUNTS[account];
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(id);
  if (existing.user?.email !== email) redirect("/login?error=demo");

  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) redirect("/login?error=demo");

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  redirect(verifyError ? "/login?error=demo" : "/");
}
