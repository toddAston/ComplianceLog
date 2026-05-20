import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";

// Proves the v1 → v2 bump is a safe, additive forward migration (CLAUDE.md Dexie rule:
// every schema bump needs a test). A seeded v1 applicationRecords row must survive the
// reopen at v2, and the new outbox store must be usable. Uses a throwaway DB name so it
// never touches the app's "fieldlog-db".

const NAME = "fieldlog-migration-test";

afterEach(async () => {
  await Dexie.delete(NAME);
});

describe("Dexie v1 → v2 migration", () => {
  it("preserves existing rows and adds the outbox store", async () => {
    // Open at v1 and seed a record (mirrors the real applicationRecords index).
    const v1 = new Dexie(NAME);
    v1.version(1).stores({
      applicationRecords:
        "&id, organizationId, workflowStatus, syncStatus, productSnapshotId, system.createdAt, system.lockedAt",
    });
    await v1.open();
    await v1.table("applicationRecords").add({
      id: "r1",
      organizationId: "o1",
      workflowStatus: "draft",
      syncStatus: "local_only",
      contractorInputs: { cropOrSite: "Soybeans" },
    });
    v1.close();

    // Reopen with the v2 delta (adds outbox + catalogMeta), as fieldlogDb does.
    const v2 = new Dexie(NAME);
    v2.version(1).stores({
      applicationRecords:
        "&id, organizationId, workflowStatus, syncStatus, productSnapshotId, system.createdAt, system.lockedAt",
    });
    v2.version(2).stores({
      outbox: "&opId, recordId, status, kind, createdAt",
      catalogMeta: "&catalogVersion, loadedAt",
    });
    await v2.open();

    // The pre-existing row survived untouched (Dexie stores rows as opaque JSON).
    const survived = await v2.table("applicationRecords").get("r1");
    expect(survived?.syncStatus).toBe("local_only");
    expect(survived?.contractorInputs?.cropOrSite).toBe("Soybeans");

    // The new store is usable.
    await v2.table("outbox").add({
      opId: "op1",
      idempotencyKey: "k1",
      recordId: "r1",
      kind: "create_draft",
      status: "pending",
      attempts: 0,
      createdAt: "2026-05-20T00:00:00Z",
      updatedAt: "2026-05-20T00:00:00Z",
    });
    expect(await v2.table("outbox").get("op1")).toBeTruthy();
    expect(v2.verno).toBe(2);
    v2.close();
  });
});
