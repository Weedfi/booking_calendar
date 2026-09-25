import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { sameOriginUrl } from "@/lib/redirect";
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
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  // "/" routes the user to the admin or owner view based on their role.
  return NextResponse.redirect(sameOriginUrl(request, ok ? "/" : "/login?error=link"));
}
