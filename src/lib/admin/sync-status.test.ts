import { describe, expect, it } from "vitest";
import { describeSyncStatus, type SyncRun } from "./sync-status";

const NOW = new Date("2031-01-15T10:00:00Z");
const run = (minutesAgo: number, overrides: Partial<SyncRun> = {}): SyncRun => {
  const startedAt = new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
  return { trigger: "cron", startedAt, finishedAt: startedAt, ok: true, error: null, ...overrides };
};

describe("describeSyncStatus", () => {
  it("reports a recent healthy sync", () => {
    expect(describeSyncStatus(run(2), 0, NOW)).toEqual({
      tone: "ok",
      text: "Last sync 2 min ago via schedule",
      detail: null,
    });
  });

  it("names the trigger", () => {
    expect(describeSyncStatus(run(0, { trigger: "email" }), 0, NOW).text).toBe("Last sync just now via email trigger");
  });

  it("warns about failing channels", () => {
    expect(describeSyncStatus(run(1), 2, NOW)).toMatchObject({ tone: "warning", detail: "2 channels are failing (red markers below)." });
  });

  it("flags a stale sync as an error, since the schedule seems to be down", () => {
    expect(describeSyncStatus(run(20), 0, NOW)).toMatchObject({ tone: "error" });
  });

  it("handles a running sync and no history", () => {
    expect(describeSyncStatus(run(0, { finishedAt: null }), 0, NOW).text).toBe("Sync running (started just now)");
    expect(describeSyncStatus(null, 0, NOW)).toMatchObject({ tone: "unknown", text: "No sync has run yet" });
  });
});
