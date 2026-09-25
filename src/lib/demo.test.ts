import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS } from "./demo";

describe("DEMO_ACCOUNTS", () => {
  // Demo sign-in only works if these match the seeded users exactly.
  const seed = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");

  it.each(Object.entries(DEMO_ACCOUNTS))("%s account exists in seed.sql", (_, account) => {
    expect(seed).toContain(`'${account.id}'::uuid, '${account.email}'`);
  });
});
