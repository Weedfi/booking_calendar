import { describe, expect, it } from "vitest";
import { hasBearerSecret, safeEqual } from "./secrets";

const headers = (authorization?: string) => new Headers(authorization ? { authorization } : {});

describe("safeEqual", () => {
  it("compares strings of any length", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("hasBearerSecret", () => {
  it("accepts the right secret", () => {
    expect(hasBearerSecret(headers("Bearer s3cret"), "s3cret")).toBe(true);
  });

  it("rejects a wrong or missing secret", () => {
    expect(hasBearerSecret(headers("Bearer nope"), "s3cret")).toBe(false);
    expect(hasBearerSecret(headers("s3cret"), "s3cret")).toBe(false);
    expect(hasBearerSecret(headers(), "s3cret")).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(hasBearerSecret(headers("Bearer "), undefined)).toBe(false);
    expect(hasBearerSecret(headers("Bearer undefined"), undefined)).toBe(false);
    expect(hasBearerSecret(headers("Bearer x"), "")).toBe(false);
  });
});
