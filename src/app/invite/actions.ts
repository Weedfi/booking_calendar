"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { inviteSecret, readInviteToken } from "@/lib/invite-token";
import { findUserByEmail, sendSignInEmail } from "@/lib/sign-in-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Accepts an invitation from /invite. Runs on the button press (a POST), not
 * on opening the link, so a mail scanner that fetches links cannot use it up.
 */
export async function acceptInvite(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const email = readInviteToken(token, inviteSecret());
  if (!email) redirect("/invite?state=invalid");

  const user = await findUserByEmail(email);
  if (!user) redirect("/invite?state=invalid");
  // Accepted already: from now on the owner signs in like everyone else.
  if (user.email_confirmed_at) redirect("/login?info=accepted");

  // Sign the owner in on the server with a fresh, single-use Supabase token.
  const { data: link, error } = await createAdminClient().auth.admin.generateLink({ type: "invite", email });
  if (error) redirect(`/invite?token=${encodeURIComponent(token)}&state=error`);
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "invite", token_hash: link.properties.hashed_token });
  if (verifyError) redirect(`/invite?token=${encodeURIComponent(token)}&state=error`);

  // The step-by-step sign-in guide follows in a second email.
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  after(() => sendSignInEmail(email, origin).catch(() => undefined));
  redirect("/");
}
