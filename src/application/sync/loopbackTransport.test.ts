import { describe, expect, it } from "vitest";
import { createLoopbackTransport } from "./loopbackTransport";
import type { SyncOperation } from "./transport";
import { buildContractorInputs, buildRecord } from "./syncTestFixtures";

const KEY = { idempotencyKey: "k" };

const op = (o: Partial<SyncOperation> & Pick<SyncOperation, "kind" | "recordId">): SyncOperation => ({
  opId: crypto.randomUUID(),
  ...o,
});

describe("loopbackTransport — create_draft", () => {
  it("creates a record and assigns a server etag", async () => {
    const t = createLoopbackTransport();
    const draft = buildRecord();
    const res = await t.syncBatch(
      { operations: [op({ kind: "create_draft", recordId: draft.id, payload: draft as unknown as Record<string, unknown> })] },
      KEY
    );
    expect(res.results[0]?.outcome).toBe("applied");
    expect(res.results[0]?.record?.etag).toBeTruthy();
    expect(res.results[0]?.record?.syncStatus).toBe("synced");
    expect(t.getServerRecord(draft.id)?.workflowStatus).toBe("draft");
  });

  it("is idempotent — replaying create_draft does not duplicate", async () => {
    const t = createLoopbackTransport();
    const draft = buildRecord();
    const payload = draft as unknown as Record<string, unknown>;
    const first = await t.syncBatch({ operations: [op({ kind: "create_draft", recordId: draft.id, payload })] }, KEY);
    const etag1 = first.results[0]?.record?.etag;
    const second = await t.syncBatch({ operations: [op({ kind: "create_draft", recordId: draft.id, payload })] }, KEY);
    expect(second.results[0]?.outcome).toBe("applied");
    // Same server record (same etag) — not re-created.
    expect(second.results[0]?.record?.etag).toBe(etag1);
  });
});

describe("loopbackTransport — ETag concurrency", () => {
  it("returns conflict when baseEtag is stale", async () => {
    const t = createLoopbackTransport([buildRecord({ id: "r1", etag: "server-v2" })]);
    const res = await t.syncBatch(
      { operations: [op({ kind: "update_inputs", recordId: "r1", baseEtag: "client-v1", payload: { cropOrSite: "Corn" } })] },
      KEY
    );
    expect(res.results[0]?.outcome).toBe("conflict");
    expect(res.results[0]?.record?.etag).toBe("server-v2");
  });

  it("applies update when baseEtag matches and bumps the etag", async () => {
    const t = createLoopbackTransport([buildRecord({ id: "r1", etag: "v1" })]);
    const res = await t.syncBatch(
      { operations: [op({ kind: "update_inputs", recordId: "r1", baseEtag: "v1", payload: { cropOrSite: "Corn" } })] },
      KEY
    );
    expect(res.results[0]?.outcome).toBe("applied");
    expect(res.results[0]?.record?.contractorInputs.cropOrSite).toBe("Corn");
    expect(res.results[0]?.record?.etag).not.toBe("v1");
  });

  it("skips the etag check when baseEtag is absent (never-synced record)", async () => {
    const t = createLoopbackTransport([buildRecord({ id: "r1", etag: "v9" })]);
    const res = await t.syncBatch(
      { operations: [op({ kind: "update_inputs", recordId: "r1", payload: { cropOrSite: "Corn" } })] },
      KEY
    );
    expect(res.results[0]?.outcome).toBe("applied");
  });
});

describe("loopbackTransport — frozen + missing records", () => {
  it("rejects mutations to a locked record", async () => {
    const t = createLoopbackTransport([
      buildRecord({ id: "r1", workflowStatus: "locked", etag: "v1" }),
    ]);
    const res = await t.syncBatch(
      { operations: [op({ kind: "update_inputs", recordId: "r1", baseEtag: "v1", payload: { cropOrSite: "Corn" } })] },
      KEY
    );
    expect(res.results[0]?.outcome).toBe("rejected");
    expect(res.results[0]?.error?.code).toBe("RECORD_LOCKED");
  });

  it("rejects ops on an unknown record", async () => {
    const t = createLoopbackTransport();
    const res = await t.syncBatch(
      { operations: [op({ kind: "submit", recordId: "missing" })] },
      KEY
    );
    expect(res.results[0]?.outcome).toBe("rejected");
    expect(res.results[0]?.error?.code).toBe("NOT_FOUND");
  });
});

describe("loopbackTransport — submit", () => {
  it("rejects submit when the record is not a draft", async () => {
    const t = createLoopbackTransport([buildRecord({ id: "r1", workflowStatus: "pending_review", etag: "v1" })]);
    const res = await t.syncBatch({ operations: [op({ kind: "submit", recordId: "r1" })] }, KEY);
    expect(res.results[0]?.outcome).toBe("rejected");
    expect(res.results[0]?.error?.code).toBe("STATUS_TRANSITION_INVALID");
  });

  it("rejects submit when attestation is not confirmed", async () => {
    const t = createLoopbackTransport([
      buildRecord({ id: "r1", contractorInputs: buildContractorInputs({ attestationConfirmed: false }) }),
    ]);
    const res = await t.syncBatch({ operations: [op({ kind: "submit", recordId: "r1" })] }, KEY);
    expect(res.results[0]?.outcome).toBe("rejected");
    expect(res.results[0]?.error?.message).toMatch(/attestation/i);
  });

  it("rejects submit blocked by a server-side compliance rule (RUP uncertified)", async () => {
    const t = createLoopbackTransport([
      buildRecord({
        id: "r1",
        contractorInputs: buildContractorInputs({ rupStatus: "yes", certificationNumber: "" }),
      }),
    ]);
    const res = await t.syncBatch({ operations: [op({ kind: "submit", recordId: "r1" })] }, KEY);
    expect(res.results[0]?.outcome).toBe("rejected");
    expect(res.results[0]?.error?.message).toMatch(/restricted-use/i);
  });

  it("applies a valid submit, transitioning to pending_review with a snapshot", async () => {
    const t = createLoopbackTransport([buildRecord({ id: "r1" })]);
    const res = await t.syncBatch({ operations: [op({ kind: "submit", recordId: "r1" })] }, KEY);
    expect(res.results[0]?.outcome).toBe("applied");
    expect(res.results[0]?.record?.workflowStatus).toBe("pending_review");
    expect(res.results[0]?.record?.productSnapshotId).toBeTruthy();
  });
});
