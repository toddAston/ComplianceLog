import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import {
  assertMutable,
  assertTransition,
  isAllowedTransition,
  isFrozen,
} from "./lifecycle";

describe("lifecycle guard", () => {
  it("permits the golden-path transitions (incl. client shortcuts)", () => {
    expect(isAllowedTransition("draft", "pending_review")).toBe(true);
    expect(isAllowedTransition("pending_review", "locked")).toBe(true);
    expect(isAllowedTransition("pending_review", "needs_correction")).toBe(true);
    expect(isAllowedTransition("needs_correction", "pending_review")).toBe(true);
    expect(isAllowedTransition("locked", "exported")).toBe(true);
  });

  it("treats a same-status update as a no-op (allowed)", () => {
    expect(isAllowedTransition("draft", "draft")).toBe(true);
    expect(isAllowedTransition("locked", "locked")).toBe(true);
  });

  it("rejects backwards and skip transitions", () => {
    expect(isAllowedTransition("locked", "draft")).toBe(false);
    expect(isAllowedTransition("draft", "locked")).toBe(false);
    expect(isAllowedTransition("exported", "locked")).toBe(false);
    expect(isAllowedTransition("pending_review", "exported")).toBe(false);
  });

  it("assertTransition throws STATUS_TRANSITION_INVALID for illegal hops", () => {
    expect(() => assertTransition("draft", "locked")).toThrowError(AppError);
    try {
      assertTransition("draft", "locked");
    } catch (e) {
      expect((e as AppError).code).toBe("STATUS_TRANSITION_INVALID");
      expect((e as AppError).statusCode).toBe(409);
    }
  });

  it("isFrozen is true only for locked and exported", () => {
    expect(isFrozen("locked")).toBe(true);
    expect(isFrozen("exported")).toBe(true);
    expect(isFrozen("pending_review")).toBe(false);
    expect(isFrozen("draft")).toBe(false);
  });

  it("assertMutable blocks edits to locked/exported records", () => {
    expect(() => assertMutable("locked", "rec-1")).toThrowError(AppError);
    try {
      assertMutable("exported", "rec-1");
    } catch (e) {
      expect((e as AppError).code).toBe("RECORD_LOCKED");
    }
    expect(() => assertMutable("draft", "rec-1")).not.toThrow();
  });
});
