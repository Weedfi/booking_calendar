import { NextResponse, type NextRequest } from "next/server";
import { sameOriginUrl } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 turns the POST into a GET of the login page.
  return NextResponse.redirect(sameOriginUrl(request, "/login"), { status: 303 });
}
