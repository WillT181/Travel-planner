import { describe, it, expect } from "vitest";
import { searchDestinations, buildIndex } from "./destinationSearch";

describe("buildIndex", () => {
  it("includes both countries and cities", () => {
    const index = buildIndex();
    expect(index.some((e) => e.type === "country")).toBe(true);
    expect(index.some((e) => e.type === "city")).toBe(true);
  });

  it("country entries have correct shape", () => {
    const index = buildIndex();
    const pt = index.find((e) => e.type === "country" && e.name === "Portugal");
    expect(pt).toBeDefined();
    expect(pt!.secondary).toBe("Country · Europe");
    expect(pt!.flag).toBe("🇵🇹");
    expect(pt!.isCapital).toBe(false);
    expect(pt!.nameLower).toBe("portugal");
  });

  it("city entries carry the parent country flag", () => {
    const index = buildIndex();
    const tokyo = index.find((e) => e.type === "city" && e.name === "Tokyo");
    expect(tokyo).toBeDefined();
    expect(tokyo!.flag).toBe("🇯🇵");
    expect(tokyo!.secondary).toBe("City · Japan");
    expect(tokyo!.isCapital).toBe(true);
  });

  it("returns the same array on subsequent calls (cached)", () => {
    expect(buildIndex()).toBe(buildIndex());
  });
});

describe("searchDestinations", () => {
  it("returns empty result for an empty query", () => {
    expect(searchDestinations("")).toEqual({ results: [], totalMatches: 0 });
    expect(searchDestinations("   ")).toEqual({ results: [], totalMatches: 0 });
  });

  it('"por" returns Portugal (country) before any city starting with por', () => {
    const { results, totalMatches } = searchDestinations("por", 20);
    expect(totalMatches).toBeGreaterThan(0);

    const first = results[0];
    expect(first.type).toBe("country");
    expect(first.name).toBe("Portugal");

    // All subsequent entries that are cities must come after Portugal.
    const cityIndex = results.findIndex((r) => r.type === "city");
    if (cityIndex !== -1) {
      expect(cityIndex).toBeGreaterThan(0);
    }
  });

  it('"tokyo" returns Tokyo as the first result (exact match, capital)', () => {
    const { results } = searchDestinations("tokyo");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Tokyo");
    expect(results[0].isCapital).toBe(true);
  });

  it("respects the limit parameter", () => {
    const { results, totalMatches } = searchDestinations("a", 5);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(totalMatches).toBeGreaterThanOrEqual(results.length);
  });

  it("totalMatches reflects all matches, not just the returned slice", () => {
    const narrow = searchDestinations("a", 3);
    const wide = searchDestinations("a", 9999);
    expect(narrow.totalMatches).toBe(wide.totalMatches);
    expect(narrow.results.length).toBeLessThanOrEqual(3);
  });

  it("exact match ranks above prefix match", () => {
    // "japan" should be an exact match for Japan (country) and appear before
    // any entry that merely starts with "japan".
    const { results } = searchDestinations("japan", 10);
    expect(results[0].nameLower).toBe("japan");
  });

  it("prefix match ranks above contains-only match", () => {
    // A query like "land" — "Iceland" starts with nothing, but "Aland Islands"
    // starts with... no. Let's use "tanz" — "Tanzania" prefix-matches and
    // should beat anything that just contains "tanz".
    const { results } = searchDestinations("tanz", 10);
    const prefixIdx = results.findIndex((r) => r.nameLower.startsWith("tanz"));
    const containsIdx = results.findIndex(
      (r) => !r.nameLower.startsWith("tanz") && r.nameLower.includes("tanz")
    );
    if (prefixIdx !== -1 && containsIdx !== -1) {
      expect(prefixIdx).toBeLessThan(containsIdx);
    }
  });

  it("non-capital prefix matches rank above capital prefix matches", () => {
    // "port" — Portugal (tier 1, country, non-capital) should precede
    // capital cities that start with "port" (tier 2).
    const { results } = searchDestinations("port", 20);
    const capitalPrefixIdx = results.findIndex(
      (r) => r.isCapital && r.nameLower.startsWith("port")
    );
    const nonCapCountryIdx = results.findIndex(
      (r) => r.type === "country" && r.nameLower.startsWith("port")
    );
    if (nonCapCountryIdx !== -1 && capitalPrefixIdx !== -1) {
      expect(nonCapCountryIdx).toBeLessThan(capitalPrefixIdx);
    }
  });
});
