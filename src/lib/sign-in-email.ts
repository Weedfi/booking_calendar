import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SignInEmailResult = "link" | "invite" | "unknown" | "rate_limited" | "error";

/**
 * Emails a user a way in. Someone with an active account gets the sign-in
 * link email (supabase/templates/magic_link.html), which doubles as the
 * step-by-step sign-in guide. Someone who never opened their invitation gets
 * the invitation again: with signups disabled, Supabase refuses to send them
 * a sign-in link. Never creates users.
 */
export async function sendSignInEmail(email: string, origin: string): Promise<SignInEmailResult> {
  const admin = createAdminClient();
  const redirectTo = `${origin}/auth/confirm`;

  const { error } = await admin.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  if (!error) return "link";
  if (error.status === 429) return "rate_limited";
  if (error.code !== "signup_disabled" && error.code !== "otp_disabled") return "error";

  // Supabase answers this way both for unknown emails and for invited users
  // who have not confirmed yet; only the second get a new invitation.
  const user = await findUserByEmail(email);
  if (!user || user.email_confirmed_at) return "unknown";
  const invite = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (invite.error?.status === 429) return "rate_limited";
  return invite.error ? "error" : "invite";
}

async function findUserByEmail(email: string) {
  // Fine for a handful of users; the Auth admin API has no lookup by email.
  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) return null;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}
