import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearRecentValues,
  getRecentValues,
  recordRecentValue,
} from "./recentValues";

const KEY = "test.someField";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  clearRecentValues(KEY);
});

describe("recentValues", () => {
  it("returns an empty array for an unseen key", () => {
    expect(getRecentValues(KEY)).toEqual([]);
  });

  it("records a value and surfaces it back as the most-recent", () => {
    recordRecentValue(KEY, "Acme");
    expect(getRecentValues(KEY)).toEqual(["Acme"]);
  });

  it("places newer values at the front (LRU order)", () => {
    recordRecentValue(KEY, "Acme");
    recordRecentValue(KEY, "Boots");
    recordRecentValue(KEY, "Cargo");
    expect(getRecentValues(KEY)).toEqual(["Cargo", "Boots", "Acme"]);
  });

  it("ignores empty and whitespace-only values", () => {
    recordRecentValue(KEY, "");
    recordRecentValue(KEY, "   ");
    expect(getRecentValues(KEY)).toEqual([]);
  });

  it("trims surrounding whitespace before storing", () => {
    recordRecentValue(KEY, "   Acme  ");
    expect(getRecentValues(KEY)).toEqual(["Acme"]);
  });

  it("bumps an existing value to the front instead of duplicating it", () => {
    recordRecentValue(KEY, "Acme");
    recordRecentValue(KEY, "Boots");
    recordRecentValue(KEY, "Acme");
    expect(getRecentValues(KEY)).toEqual(["Acme", "Boots"]);
  });

  it("caps the stored list at the default of 8 entries", () => {
    for (let i = 0; i < 12; i++) {
      recordRecentValue(KEY, `value-${i}`);
    }
    const result = getRecentValues(KEY);
    expect(result.length).toBe(8);
    // Most recent (value-11) is at index 0; oldest retained is value-4.
    expect(result[0]).toBe("value-11");
    expect(result[result.length - 1]).toBe("value-4");
  });

  it("respects an explicit smaller cap when supplied", () => {
    for (let i = 0; i < 5; i++) recordRecentValue(KEY, `v-${i}`, 3);
    expect(getRecentValues(KEY).length).toBe(3);
  });

  it("scopes entries per field key — different keys don't see each other", () => {
    recordRecentValue("k.one", "alpha");
    recordRecentValue("k.two", "beta");
    expect(getRecentValues("k.one")).toEqual(["alpha"]);
    expect(getRecentValues("k.two")).toEqual(["beta"]);
  });

  it("clearRecentValues empties only the requested key", () => {
    recordRecentValue("k.one", "alpha");
    recordRecentValue("k.two", "beta");
    clearRecentValues("k.one");
    expect(getRecentValues("k.one")).toEqual([]);
    expect(getRecentValues("k.two")).toEqual(["beta"]);
  });

  it("tolerates a corrupt localStorage entry (returns empty, does not throw)", () => {
    window.localStorage.setItem("fieldlog-recent:bad", "not-json");
    expect(getRecentValues("bad")).toEqual([]);
  });

  it("tolerates a non-array localStorage entry", () => {
    window.localStorage.setItem(
      "fieldlog-recent:obj",
      JSON.stringify({ unexpected: "shape" })
    );
    expect(getRecentValues("obj")).toEqual([]);
  });

  it("strips non-string elements from a partially-corrupt entry", () => {
    window.localStorage.setItem(
      "fieldlog-recent:mixed",
      JSON.stringify(["good", 42, null, "fine"])
    );
    expect(getRecentValues("mixed")).toEqual(["good", "fine"]);
  });
});
