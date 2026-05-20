import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/fieldlogDb";
import {
  buildOutboxOp,
  getPendingOperations,
  markFailed,
  markInflight,
  markPending,
  removeOp,
} from "./outbox";

beforeEach(async () => {
  await db.outbox.clear();
});

describe("buildOutboxOp", () => {
  it("creates a pending op with ids, zero attempts, and timestamps", () => {
    const op = buildOutboxOp({ recordId: "r1", kind: "submit", baseEtag: "v1" });
    expect(op.status).toBe("pending");
    expect(op.attempts).toBe(0);
    expect(op.opId).toBeTruthy();
    expect(op.idempotencyKey).toBeTruthy();
    expect(op.opId).not.toBe(op.idempotencyKey);
    expect(op.recordId).toBe("r1");
    expect(op.baseEtag).toBe("v1");
    expect(op.createdAt).toBeTruthy();
  });
});

describe("getPendingOperations", () => {
  it("returns pending and failed ops oldest-first, excluding inflight/done", async () => {
    const a = { ...buildOutboxOp({ recordId: "r1", kind: "create_draft" }), createdAt: "2026-01-01T00:00:00Z" };
    const b = { ...buildOutboxOp({ recordId: "r1", kind: "submit" }), createdAt: "2026-01-02T00:00:00Z", status: "failed" as const };
    const c = { ...buildOutboxOp({ recordId: "r2", kind: "submit" }), createdAt: "2026-01-03T00:00:00Z", status: "inflight" as const };
    await db.outbox.bulkAdd([b, a, c]);

    const pending = await getPendingOperations();
    expect(pending.map((o) => o.recordId)).toEqual(["r1", "r1"]);
    // oldest first: create (a) before failed submit (b)
    expect(pending[0]?.kind).toBe("create_draft");
    expect(pending[1]?.kind).toBe("submit");
  });
});

describe("op state transitions", () => {
  it("markInflight / markFailed / markPending / removeOp behave correctly", async () => {
    const op = buildOutboxOp({ recordId: "r1", kind: "submit" });
    await db.outbox.add(op);

    await markInflight(op.opId);
    expect((await db.outbox.get(op.opId))?.status).toBe("inflight");

    await markFailed(op, "boom");
    const failed = await db.outbox.get(op.opId);
    expect(failed?.status).toBe("failed");
    expect(failed?.attempts).toBe(1);
    expect(failed?.lastError).toBe("boom");

    await markPending(op.opId);
    expect((await db.outbox.get(op.opId))?.status).toBe("pending");

    await removeOp(op.opId);
    expect(await db.outbox.get(op.opId)).toBeUndefined();
  });
});
