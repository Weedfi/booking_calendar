import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvixSignature } from "./svix";

// A made-up signing secret in Resend's format.
const KEY = Buffer.from("test-signing-key-32-bytes-long!!");
const SECRET = `whsec_${KEY.toString("base64")}`;
const NOW = new Date("2026-09-28T12:00:00Z");
const TIMESTAMP = String(Math.floor(NOW.getTime() / 1000));
const BODY = JSON.stringify({ type: "email.received", data: { email_id: "abc" } });

const sign = (body: string, id = "msg_1", timestamp = TIMESTAMP) =>
  createHmac("sha256", KEY).update(`${id}.${timestamp}.${body}`).digest("base64");

const headers = (signature: string, id = "msg_1", timestamp = TIMESTAMP) =>
  new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature });

describe("verifySvixSignature", () => {
  it("accepts a correctly signed request", () => {
    expect(verifySvixSignature(BODY, headers(`v1,${sign(BODY)}`), SECRET, NOW)).toBe(true);
  });

  it("accepts one valid signature among several (secret rotation)", () => {
    expect(verifySvixSignature(BODY, headers(`v1,Zm9vYmFy v1,${sign(BODY)}`), SECRET, NOW)).toBe(true);
  });

  it("rejects a changed body", () => {
    expect(verifySvixSignature(`${BODY} `, headers(`v1,${sign(BODY)}`), SECRET, NOW)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const other = `whsec_${Buffer.from("another-key-entirely-different!!").toString("base64")}`;
    expect(verifySvixSignature(BODY, headers(`v1,${sign(BODY)}`), other, NOW)).toBe(false);
  });

  it("rejects old requests (replays)", () => {
    const old = String(Number(TIMESTAMP) - 10 * 60);
    expect(verifySvixSignature(BODY, headers(`v1,${sign(BODY, "msg_1", old)}`, "msg_1", old), SECRET, NOW)).toBe(false);
  });

  it("fails closed without a secret or headers", () => {
    expect(verifySvixSignature(BODY, headers(`v1,${sign(BODY)}`), undefined, NOW)).toBe(false);
    expect(verifySvixSignature(BODY, new Headers(), SECRET, NOW)).toBe(false);
  });
});
