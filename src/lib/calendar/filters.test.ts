import { describe, expect, it } from "vitest";
import { filtersToQuery, parseAdminFilters } from "./filters";

const TODAY = "2031-01-15"; // Wednesday
const OWNER = "b0000000-0000-4000-8000-000000000001";

describe("parseAdminFilters", () => {
  it("defaults to two weeks from this week's Monday", () => {
    expect(parseAdminFilters({}, TODAY)).toEqual({
      ownerId: null,
      propertyId: null,
      source: null,
      from: "2031-01-13",
      days: 14,
    });
  });

  it("reads valid values", () => {
    expect(
      parseAdminFilters({ owner: OWNER, channel: "airbnb", from: "2031-02-01", days: "31" }, TODAY),
    ).toMatchObject({ ownerId: OWNER, source: "airbnb", from: "2031-02-01", days: 31 });
  });

  it("ignores malformed values instead of failing", () => {
    const params = { owner: "1 OR 1=1", property: ["a", "b"], channel: "vrbo", from: "2031-02-30", days: "9999" };
    expect(parseAdminFilters(params, TODAY)).toEqual(parseAdminFilters({}, TODAY));
  });
});

describe("filtersToQuery", () => {
  it("omits defaults", () => {
    expect(filtersToQuery(parseAdminFilters({}, TODAY), TODAY)).toBe("");
  });

  it("round-trips through parseAdminFilters", () => {
    const filters = parseAdminFilters({ owner: OWNER, channel: "booking", from: "2031-03-03", days: "7" }, TODAY);
    const query = filtersToQuery(filters, TODAY);
    expect(parseAdminFilters(Object.fromEntries(new URLSearchParams(query)), TODAY)).toEqual(filters);
  });
});
