import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EmailTriggerInfo } from "@/lib/sync/store";
import { DEBOUNCE_MS, FOLLOW_UP_DELAY_MS, handleEmailTrigger, type EmailTriggerDeps } from "./handler";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../tests/fixtures/emails/${name}.json`, import.meta.url), "utf8"));

const SECRET = "test-secret";
const NOW = new Date("2026-09-25T10:15:05Z");
const auth = new Headers({ authorization: `Bearer ${SECRET}` });

function setup(lastEmailSync: Date | null = null) {
  const syncs: { propertyId: string | null; info: EmailTriggerInfo }[] = [];
  const sleeps: number[] = [];
  const later: (() => Promise<void>)[] = [];
  const lookups: (string | null)[] = [];

  const deps: EmailTriggerDeps = {
    secret: SECRET,
    now: () => NOW,
    listProperties: async () => [
      { id: "wawel", name: "Wawel View Apartment", bookingPropertyId: "1000003" },
      { id: "kazimierz", name: "Kazimierz Studio", bookingPropertyId: "1000002" },
    ],
    lastEmailSyncAt: async (propertyId) => {
      lookups.push(propertyId);
      return lastEmailSync;
    },
    sync: async (propertyId, info) => {
      syncs.push({ propertyId, info });
      return { ok: true, channels: 1, failed: 0, upserted: 1, cancelled: 0 };
    },
    runLater: (task) => later.push(task),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return { deps, syncs, sleeps, later, lookups };
}

describe("handleEmailTrigger", () => {
  it("rejects a missing or wrong secret without doing anything", async () => {
    const { deps, syncs } = setup();
    const wrong = new Headers({ authorization: "Bearer nope" });

    expect((await handleEmailTrigger(new Headers(), fixture("new-booking-with-id"), deps)).status).toBe(401);
    expect((await handleEmailTrigger(wrong, fixture("new-booking-with-id"), deps)).status).toBe(401);
    expect(syncs).toEqual([]);
  });

  it("fails closed when no secret is configured", async () => {
    const { deps } = setup();
    const result = await handleEmailTrigger(new Headers({ authorization: "Bearer " }), {}, { ...deps, secret: undefined });
    expect(result.status).toBe(401);
  });

  it("rejects an invalid payload", async () => {
    const { deps } = setup();
    expect((await handleEmailTrigger(auth, { subject: "no sender" }, deps)).status).toBe(400);
  });

  it("ignores emails that are not from Booking.com", async () => {
    const { deps, syncs } = setup();
    const result = await handleEmailTrigger(auth, fixture("phishing-lookalike"), deps);
    expect(result.status).toBe(202);
    expect(syncs).toEqual([]);
  });

  it("syncs the matched property now and once more after a delay", async () => {
    const { deps, syncs, sleeps, later } = setup();

    const result = await handleEmailTrigger(auth, fixture("new-booking-with-id"), deps);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ propertyId: "wawel", matchedBy: "booking_id", ok: true });
    expect(syncs).toEqual([
      { propertyId: "wawel", info: { receivedAt: new Date("2026-09-25T10:15:00Z"), matchedBy: "booking_id" } },
    ]);

    await later[0]();
    expect(sleeps).toEqual([FOLLOW_UP_DELAY_MS]);
    expect(syncs.map((s) => s.propertyId)).toEqual(["wawel", "wawel"]);
  });

  it("falls back to syncing every property when it cannot tell which one", async () => {
    const { deps, syncs, lookups } = setup();
    const result = await handleEmailTrigger(auth, fixture("unknown-format"), deps);

    expect(result.body).toMatchObject({ propertyId: null, matchedBy: "none" });
    expect(syncs[0].propertyId).toBeNull();
    expect(lookups).toEqual([null]);
  });

  it("debounces a second email for the same property within 20 s", async () => {
    const { deps, syncs, later } = setup(new Date(NOW.getTime() - DEBOUNCE_MS + 1000));
    const result = await handleEmailTrigger(auth, fixture("new-booking-with-id"), deps);

    expect(result).toEqual({ status: 202, body: { debounced: true, propertyId: "wawel", matchedBy: "booking_id", guestSaved: false } });
    expect(syncs).toEqual([]);
    expect(later).toEqual([]);
  });

  it("syncs again once the debounce window has passed", async () => {
    const { deps, syncs } = setup(new Date(NOW.getTime() - DEBOUNCE_MS - 1000));
    await handleEmailTrigger(auth, fixture("new-booking-with-id"), deps);
    expect(syncs).toHaveLength(1);
  });

  it("never echoes email content in the response", async () => {
    const { deps } = setup();
    const result = await handleEmailTrigger(auth, fixture("new-booking-with-id"), deps);
    const json = JSON.stringify(result.body);
    expect(json).not.toContain("Jane Example");
    expect(json).not.toContain("EUR");
  });
});

describe("handleEmailTrigger guest names", () => {
  it("stores the guest's name and dates for the matched property", async () => {
    const { deps } = setup();
    const saved: unknown[] = [];
    const result = await handleEmailTrigger(auth, fixture("new-booking-with-id"), {
      ...deps,
      saveGuest: async (propertyId, guest) => {
        saved.push({ propertyId, ...guest });
      },
    });
    expect(saved).toEqual([{ propertyId: "wawel", guestName: "Jane Example", checkIn: "2026-10-09", checkOut: "2026-10-12" }]);
    expect(result.body).toMatchObject({ guestSaved: true });
    // The name itself is never echoed back.
    expect(JSON.stringify(result.body)).not.toContain("Jane");
  });

  it("stores the name even when the sync is debounced", async () => {
    const { deps } = setup(new Date(NOW.getTime() - 5_000));
    const saved: unknown[] = [];
    await handleEmailTrigger(auth, fixture("new-booking-with-id"), { ...deps, saveGuest: async (_p, g) => void saved.push(g) });
    expect(saved).toHaveLength(1);
  });

  it("does not store a name when the property is unknown", async () => {
    const { deps } = setup();
    const saved: unknown[] = [];
    const body = { ...fixture("unknown-format"), text: "Gość: Anna Nowak\nZameldowanie: 2026-10-01\nWymeldowanie: 2026-10-03" };
    await handleEmailTrigger(auth, body, { ...deps, saveGuest: async (_p, g) => void saved.push(g) });
    expect(saved).toEqual([]);
  });
});
