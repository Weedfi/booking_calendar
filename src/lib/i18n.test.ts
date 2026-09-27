import { describe, expect, it } from "vitest";
import { nightsLabel, plural } from "./i18n";

describe("plural", () => {
  const forms: [string, string, string] = ["noc", "noce", "nocy"];

  it.each([
    [1, "noc"],
    [2, "noce"],
    [4, "noce"],
    [5, "nocy"],
    [11, "nocy"],
    [12, "nocy"],
    [14, "nocy"],
    [21, "nocy"],
    [22, "noce"],
    [25, "nocy"],
    [0, "nocy"],
  ])("%i -> %s", (count, expected) => {
    expect(plural(count, forms)).toBe(expected);
  });

  it("builds night labels", () => {
    expect(nightsLabel(3)).toBe("3 noce");
  });
});
