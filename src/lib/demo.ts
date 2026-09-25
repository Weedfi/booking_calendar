/**
 * Public demo mode (DEMO_MODE=true): visitors sign in with one click as the
 * seeded demo admin or owner, and every write is refused so the shared demo
 * data stays intact. Never enable it on a deployment with real data.
 */

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** Seeded accounts (supabase/seed.sql). Fixed IDs, so nothing else can be used. */
export const DEMO_ACCOUNTS = {
  admin: { id: "a0000000-0000-4000-8000-000000000001", email: "admin@example.com" },
  owner: { id: "b0000000-0000-4000-8000-000000000001", email: "anna@example.com" },
} as const;

export type DemoAccount = keyof typeof DEMO_ACCOUNTS;

export const DEMO_READ_ONLY_MESSAGE = "Changes are disabled in the public demo. Everything else works.";
