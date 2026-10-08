import { describe, expect, it } from "vitest";
import { checkNewPassword } from "./password";

describe("checkNewPassword", () => {
  it("accepts a long enough password typed twice", () => {
    expect(checkNewPassword("correct horse", "correct horse")).toEqual({ ok: true });
  });

  it("rejects a short password", () => {
    expect(checkNewPassword("short", "short").ok).toBe(false);
  });

  it("rejects a password made of spaces", () => {
    expect(checkNewPassword("        ", "        ").ok).toBe(false);
  });

  it("rejects a password longer than bcrypt can hash", () => {
    const long = "ż".repeat(37); // 74 bytes
    expect(checkNewPassword(long, long).ok).toBe(false);
  });

  it("rejects a confirmation that does not match", () => {
    expect(checkNewPassword("correct horse", "correct hors").ok).toBe(false);
  });
});
