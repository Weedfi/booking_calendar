import "server-only";
import type { User } from "@supabase/supabase-js";
import { createInviteToken, inviteSecret } from "@/lib/invite-token";
import { createAdminClient } from "@/lib/supabase/admin";

export type SignInEmailResult = "link" | "invite" | "unknown" | "rate_limited" | "error";
export type InviteResult = "invite" | "exists" | "rate_limited" | "error";

/**
 * Emails a user a way in, by the state of their account:
 * - not accepted the invitation yet: the invitation again, the same email
 *   as the first time (never Supabase's sign-up confirmation email);
 * - active account: the sign-in link email, which doubles as the
 *   step-by-step sign-in guide (supabase/templates/magic_link.html);
 * - unknown address: nothing. Never creates users.
 */
export async function sendSignInEmail(email: string, origin: string): Promise<SignInEmailResult> {
  const user = await findUserByEmail(email);
  if (!user) return "unknown";
  if (!user.email_confirmed_at) {
    const result = await sendInvite(email, origin);
    return result === "exists" ? "error" : result;
  }

  const { error } = await createAdminClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (!error) return "link";
  return error.status === 429 ? "rate_limited" : "error";
}

/**
 * Sends the invitation email (supabase/templates/invite.html), for a new
 * owner or again for one who has not accepted yet. Its link goes to /invite
 * with a token that never expires (see invite-token.ts), stored in the user
 * metadata so the template can read it as {{ .Data.invite_token }}.
 */
export async function sendInvite(email: string, origin: string, fullName?: string): Promise<InviteResult> {
  const admin = createAdminClient();
  const user = await findUserByEmail(email);
  if (user?.email_confirmed_at) return "exists";

  const data = {
    ...(user?.user_metadata ?? {}),
    ...(fullName ? { full_name: fullName } : {}),
    invite_token: createInviteToken(email, inviteSecret()),
  };
  if (user) {
    // A repeat invitation keeps the existing user; make sure it carries the token.
    const { error } = await admin.auth.admin.updateUserById(user.id, { user_metadata: data });
    if (error) return "error";
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, { data, redirectTo: `${origin}/auth/confirm` });
  if (error?.status === 429) return "rate_limited";
  if (error?.code === "email_exists" || /already been registered/i.test(error?.message ?? "")) return "exists";
  return error ? "error" : "invite";
}

export async function findUserByEmail(email: string): Promise<User | null> {
  // Fine for a handful of users; the Auth admin API has no lookup by email.
  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) return null;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}
