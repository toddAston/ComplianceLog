import { describe, expect, it } from "vitest";
import { AppError, toErrorBody } from "./errors";

describe("toErrorBody", () => {
  it("maps an AppError to its status code and preserves code/message/details", () => {
    const err = new AppError("VALIDATION_FAILED", "Bad acres.", [
      { path: "contractorInputs.acresTreated", message: "Acres must be a number." },
    ]);
    const { statusCode, body } = toErrorBody(err, "req-1");
    expect(statusCode).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.message).toBe("Bad acres.");
    expect(body.error.requestId).toBe("req-1");
    expect(body.error.details?.[0]?.path).toBe("contractorInputs.acresTreated");
  });

  it("maps RECORD_LOCKED to 409 and STATUS_TRANSITION_INVALID to 409", () => {
    expect(toErrorBody(new AppError("RECORD_LOCKED", "x"), "r").statusCode).toBe(409);
    expect(
      toErrorBody(new AppError("STATUS_TRANSITION_INVALID", "x"), "r").statusCode
    ).toBe(409);
  });

  it("maps CONFLICT_STALE_RECORD to 412 and NOT_IMPLEMENTED to 501", () => {
    expect(
      toErrorBody(new AppError("CONFLICT_STALE_RECORD", "x"), "r").statusCode
    ).toBe(412);
    expect(toErrorBody(new AppError("NOT_IMPLEMENTED", "x"), "r").statusCode).toBe(501);
  });

  it("collapses an unknown error to a generic 500 and never leaks internals", () => {
    const leaky = new Error("connection to db failed: password=hunter2 at pg.ts:42");
    const { statusCode, body } = toErrorBody(leaky, "req-2");
    expect(statusCode).toBe(500);
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).toBe("An unexpected error occurred.");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(JSON.stringify(body)).not.toContain("pg.ts");
  });

  it("omits details when none provided", () => {
    const { body } = toErrorBody(new AppError("NOT_FOUND", "nope"), "r");
    expect(body.error.details).toBeUndefined();
  });
});
