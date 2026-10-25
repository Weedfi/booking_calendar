import { afterAll, describe, expect, it } from "vitest";
import { anonClient, serviceClient, signInAs } from "./helpers";

/** What removing an owner (deleting their Auth user) does to the data. */

const db = serviceClient();
const runId = Date.now().toString(36);
const createdProperties: string[] = [];

afterAll(async () => {
  if (createdProperties.length) await db.from("properties").delete().in("id", createdProperties);
});

describe("removing an owner", () => {
  it("keeps their properties, unassigned, and ends their access", async () => {
    const email = `owner-delete-${runId}@test.local`;
    const { data: user, error: userError } = await db.auth.admin.createUser({ email, email_confirm: true });
    expect(userError).toBeNull();
    const ownerId = user.user!.id;

    const { data: property, error: propertyError } = await db
      .from("properties")
      .insert({ name: `owned-${runId}`, owner_id: ownerId })
      .select("id")
      .single();
    expect(propertyError).toBeNull();
    createdProperties.push(property!.id);

    // A session from before the removal.
    const owner = await signInAs(email);
    expect((await owner.from("properties").select("id")).data).toHaveLength(1);

    const { error } = await db.auth.admin.deleteUser(ownerId);
    expect(error).toBeNull();

    const { data: profile } = await db.from("profiles").select("id").eq("id", ownerId).maybeSingle();
    expect(profile).toBeNull();
    const { data: kept } = await db.from("properties").select("owner_id").eq("id", property!.id).single();
    expect(kept?.owner_id).toBeNull();

    // Even the old token no longer sees the property, and the app's sign-in
    // (which never creates users) refuses the address.
    expect((await owner.from("properties").select("id")).data).toHaveLength(0);
    const { error: signInError } = await anonClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    expect(signInError).not.toBeNull();
  });
});
