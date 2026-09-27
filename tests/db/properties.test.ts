import { afterAll, describe, expect, it } from "vitest";
import { serviceClient } from "./helpers";

/** Schema rules for properties that the admin forms rely on. */

const db = serviceClient();
const runId = Date.now().toString(36);
const created: string[] = [];

afterAll(async () => {
  if (created.length) await db.from("properties").delete().in("id", created);
});

describe("properties", () => {
  it("lets several apartments share one Booking.com property ID", async () => {
    const { data, error } = await db
      .from("properties")
      .insert([
        { name: `room-a-${runId}`, booking_property_id: "987654321", booking_room_name: "Apartament A" },
        { name: `room-b-${runId}`, booking_property_id: "987654321", booking_room_name: "Apartament B" },
      ])
      .select("id");
    expect(error).toBeNull();
    created.push(...(data ?? []).map((p) => p.id));
    expect(data).toHaveLength(2);
  });

  it("rejects an empty or overlong room name", async () => {
    const { error } = await db.from("properties").insert({ name: `bad-${runId}`, booking_room_name: "x".repeat(101) });
    expect(error?.code).toBe("23514"); // check_violation
  });
});
