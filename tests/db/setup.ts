import { config } from "dotenv";

// Locally the values come from .env.local; in CI they are set as env vars.
config({ path: ".env.local", quiet: true });

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) {
  if (!process.env[name]) {
    throw new Error(
      `${name} is not set. Run \`npx supabase start\` and copy the values into .env.local.`,
    );
  }
}
