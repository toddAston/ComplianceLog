import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import {
  acresFromDb,
  acresToDb,
  dateToDb,
  optionalTimeToDb,
  timeFromDb,
  timeToDb,
} from "./mapping";

describe("acresToDb", () => {
  it("maps empty/undefined/whitespace to null", () => {
    expect(acresToDb("")).toBeNull();
    expect(acresToDb(undefined)).toBeNull();
    expect(acresToDb("   ")).toBeNull();
  });

  it('keeps "0" as a real zero, not null', () => {
    expect(acresToDb("0")).toBe("0");
  });

  it("preserves a decimal string verbatim", () => {
    expect(acresToDb("12.50")).toBe("12.50");
  });

  it("throws VALIDATION_FAILED on non-numeric input", () => {
    expect(() => acresToDb("ten")).toThrowError(AppError);
    try {
      acresToDb("ten");
    } catch (e) {
      expect((e as AppError).code).toBe("VALIDATION_FAILED");
      expect((e as AppError).details?.[0]?.path).toBe("contractorInputs.acresTreated");
    }
  });

  it("throws on negative acres", () => {
    expect(() => acresToDb("-1")).toThrowError(AppError);
  });
});

describe("acresFromDb", () => {
  it("maps null back to empty string (client wire shape)", () => {
    expect(acresFromDb(null)).toBe("");
    expect(acresFromDb("12.50")).toBe("12.50");
  });
});

describe("dateToDb", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(dateToDb("2026-05-20")).toBe("2026-05-20");
  });

  it("rejects malformed or empty dates", () => {
    expect(() => dateToDb("")).toThrowError(AppError);
    expect(() => dateToDb("05/20/2026")).toThrowError(AppError);
    expect(() => dateToDb("2026-5-2")).toThrowError(AppError);
  });
});

describe("time mapping", () => {
  it("accepts HH:mm and HH:mm:ss to DB", () => {
    expect(timeToDb("08:30", "f")).toBe("08:30");
    expect(timeToDb("08:30:15", "f")).toBe("08:30:15");
  });

  it("rejects bad times", () => {
    expect(() => timeToDb("25:00", "f")).toThrowError(AppError);
    expect(() => timeToDb("8:5", "f")).toThrowError(AppError);
    expect(() => timeToDb("", "f")).toThrowError(AppError);
  });

  it("normalizes HH:mm:ss from DB back to HH:mm", () => {
    expect(timeFromDb("08:30:00")).toBe("08:30");
    expect(timeFromDb("08:30")).toBe("08:30");
    expect(timeFromDb(null)).toBe("");
  });

  it("optionalTimeToDb maps empty/undefined to null", () => {
    expect(optionalTimeToDb(undefined, "f")).toBeNull();
    expect(optionalTimeToDb("", "f")).toBeNull();
    expect(optionalTimeToDb("17:45", "f")).toBe("17:45");
  });
});
