import { describe, it, expect } from "vitest";
import { rules } from "./index";
import { DEFAULT_SEVERITY, severityOf } from "./helpers";

// Matrix item #80: every compliance check result must carry a source tag.
// Enforced here as a build-time invariant over the rule set so a rule can never
// ship with an empty citation (which would surface as SOURCE_UNAVAILABLE).
describe("compliance source-tag invariant (matrix #80)", () => {
  it("every rule has a non-empty citation and citationShort", () => {
    for (const rule of rules) {
      expect(rule.citation.trim().length, `${rule.ruleId} citation`).toBeGreaterThan(0);
      expect(
        rule.citationShort.trim().length,
        `${rule.ruleId} citationShort`
      ).toBeGreaterThan(0);
    }
  });

  it("every rule has a description and message", () => {
    for (const rule of rules) {
      expect(rule.description.trim().length, `${rule.ruleId} description`).toBeGreaterThan(0);
      expect(rule.message.trim().length, `${rule.ruleId} message`).toBeGreaterThan(0);
    }
  });

  it("every rule resolves to a valid severity via its resultCode or override", () => {
    for (const rule of rules) {
      const sev = severityOf(rule);
      expect(["warning", "error", "blocked"]).toContain(sev);
      // resultCode must be a key in the default-severity map.
      expect(Object.keys(DEFAULT_SEVERITY)).toContain(rule.resultCode);
    }
  });

  it("rule ids are unique", () => {
    const ids = rules.map((r) => r.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
