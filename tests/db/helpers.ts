import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Client with the secret key. Bypasses RLS; used only to arrange test data. */
export function serviceClient(): SupabaseClient {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SECRET_KEY"),
    clientOptions,
  );
}

/** Client with the publishable key and no session, like a logged-out visitor. */
export function anonClient(): SupabaseClient {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    clientOptions,
  );
}

/**
 * Signs in the same way the app does (magic link), without an inbox:
 * the admin API generates the link and we verify its token directly.
 */
export async function signInAs(email: string): Promise<SupabaseClient> {
  const { data: link, error: linkError } = await serviceClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const client = anonClient();
  const { error } = await client.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error) throw error;
  return client;
}
