import type { EmailOtpType } from "@supabase/supabase-js";
import { after, NextResponse, type NextRequest } from "next/server";
import { sameOriginUrl } from "@/lib/redirect";
import { sendSignInEmail } from "@/lib/sign-in-email";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing page of the magic link email. Supports both the token_hash link
 * (see supabase/templates/magic_link.html, works across devices) and the
 * default PKCE ?code= link.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    // The invitation is the welcome; the step-by-step sign-in guide follows
    // in a second email (the sign-in link one), so the owner can keep it.
    const email = data.user?.email;
    if (ok && type === "invite" && email) {
      after(() => sendSignInEmail(email, request.nextUrl.origin).catch(() => undefined));
    }
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  // "/" routes the user to the admin or owner view based on their role.
  return NextResponse.redirect(sameOriginUrl(request, ok ? "/" : "/login?error=link"));
}
