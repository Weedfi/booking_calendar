import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "owner";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: Role;
};

/** The signed-in user and their role, or null. Cached for one request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  // getClaims() verifies the JWT; never trust getSession() on the server.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", claims.sub)
    .single();
  if (!profile) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName: profile.full_name,
    role: profile.role,
  };
});

/** Use at the top of a page: redirects unless the user has the given role. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homePath(user.role));
  return user;
}

export function homePath(role: Role): string {
  return role === "admin" ? "/admin" : "/owner";
}
