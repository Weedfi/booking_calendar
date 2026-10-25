import { describe, expect, it } from "vitest";
import { createInviteToken, readInviteToken } from "./invite-token";

const SECRET = "test-secret";

describe("invite tokens", () => {
  it("round-trips the email address, lowercased", () => {
    const token = createInviteToken("Anna@Example.com", SECRET);
    expect(readInviteToken(token, SECRET)).toBe("anna@example.com");
  });

  it("rejects a token signed with another secret", () => {
    expect(readInviteToken(createInviteToken("anna@example.com", "other"), SECRET)).toBeNull();
  });

  it("rejects a token whose address was swapped", () => {
    const [version, , sig] = createInviteToken("anna@example.com", SECRET).split(".");
    const forged = `${version}.${Buffer.from("eve@example.com").toString("base64url")}.${sig}`;
    expect(readInviteToken(forged, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const token of ["", "v1", "v1..", "v2.YQ.x", "garbage.token.here"]) {
      expect(readInviteToken(token, SECRET)).toBeNull();
    }
  });
});
