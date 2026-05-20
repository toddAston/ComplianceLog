import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/fieldlogDb";
import { seedDemoData, DEMO_ORG_ID } from "../../db/seed";
import {
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "../applicationRecordService";
import { buildOutboxOp } from "./outbox";
import { createLoopbackTransport } from "./loopbackTransport";
import {
  adoptServerCopy,
  flushOutbox,
  retryRecordSync,
} from "./syncService";
import type { SyncTransport } from "./transport";
import { buildContractorInputs, buildRecord } from "./syncTestFixtures";

const ACTOR: ActorContext = {
  userId: "user-demo-applicator",
  displayName: "Demo Applicator",
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

describe("flushOutbox — offline → queue → online → synced", () => {
  it("syncs a created+submitted record and clears the outbox", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      ACTOR
    );
    await submitApplicationRecord(draft.id, ACTOR);

    expect(await db.outbox.count()).toBe(2); // create_draft + submit

    const transport = createLoopbackTransport();
    const summary = await flushOutbox(transport);

    expect(summary.applied).toBe(2);
    expect(summary.conflicts).toBe(0);
    expect(summary.rejected).toBe(0);

    const after = await db.applicationRecords.get(draft.id);
    expect(after?.syncStatus).toBe("synced");
    expect(after?.workflowStatus).toBe("pending_review");
    expect(after?.etag).toBeTruthy();
    expect(after?.lastSyncedAt).toBeTruthy();
    expect(await db.outbox.count()).toBe(0);
  });

  it("is a no-op on the second flush (idempotent — ops already drained)", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      ACTOR
    );
    await submitApplicationRecord(draft.id, ACTOR);
    const transport = createLoopbackTransport();
    await flushOutbox(transport);

    const summary = await flushOutbox(transport);
    expect(summary.processed).toBe(0);
  });
});

describe("flushOutbox — conflict (server has a newer version)", () => {
  it("marks the record sync_failed and stashes the server copy", async () => {
    const rec = buildRecord({ id: "rc", workflowStatus: "draft", etag: "old", syncStatus: "queued" });
    await db.applicationRecords.put(rec);
    await db.outbox.add(buildOutboxOp({ recordId: "rc", kind: "submit", baseEtag: "old" }));

    // Server moved on: same record, new etag.
    const transport = createLoopbackTransport([{ ...rec, etag: "new" }]);
    const summary = await flushOutbox(transport);

    expect(summary.conflicts).toBe(1);
    const after = await db.applicationRecords.get("rc");
    expect(after?.syncStatus).toBe("sync_failed");
    expect(after?.serverShadow).toBeTruthy();
    expect((await db.outbox.get(await firstOpId("rc")))?.status).toBe("failed");
  });

  it("adoptServerCopy replaces the local record and drops the queued op", async () => {
    const rec = buildRecord({ id: "rc", workflowStatus: "draft", etag: "old", syncStatus: "queued" });
    await db.applicationRecords.put(rec);
    await db.outbox.add(buildOutboxOp({ recordId: "rc", kind: "submit", baseEtag: "old" }));
    const transport = createLoopbackTransport([
      { ...rec, etag: "new", contractorInputs: buildContractorInputs({ cropOrSite: "Server Corn" }) },
    ]);
    await flushOutbox(transport);

    await adoptServerCopy("rc");

    const after = await db.applicationRecords.get("rc");
    expect(after?.syncStatus).toBe("synced");
    expect(after?.etag).toBe("new");
    expect(after?.contractorInputs.cropOrSite).toBe("Server Corn");
    expect(after?.serverShadow).toBeUndefined();
    expect(await db.outbox.where("recordId").equals("rc").count()).toBe(0);
  });
});

describe("flushOutbox — rejected", () => {
  it("marks sync_failed with the server's reason", async () => {
    const rec = buildRecord({ id: "rr", workflowStatus: "draft", syncStatus: "queued" });
    await db.applicationRecords.put(rec);
    await db.outbox.add(buildOutboxOp({ recordId: "rr", kind: "submit" }));
    // Server copy fails attestation, so submit is rejected.
    const transport = createLoopbackTransport([
      { ...rec, contractorInputs: buildContractorInputs({ attestationConfirmed: false }) },
    ]);

    const summary = await flushOutbox(transport);
    expect(summary.rejected).toBe(1);
    const after = await db.applicationRecords.get("rr");
    expect(after?.syncStatus).toBe("sync_failed");
    expect(after?.syncError).toMatch(/attestation/i);
  });

  it("retryRecordSync re-arms a failed record for the next flush", async () => {
    const rec = buildRecord({ id: "rr", workflowStatus: "draft", syncStatus: "queued" });
    await db.applicationRecords.put(rec);
    await db.outbox.add(buildOutboxOp({ recordId: "rr", kind: "submit" }));
    const transport = createLoopbackTransport([
      { ...rec, contractorInputs: buildContractorInputs({ attestationConfirmed: false }) },
    ]);
    await flushOutbox(transport);

    await retryRecordSync("rr");
    const after = await db.applicationRecords.get("rr");
    expect(after?.syncStatus).toBe("queued");
    expect((await db.outbox.where("recordId").equals("rr").first())?.status).toBe("pending");
  });
});

describe("flushOutbox — transport failure (offline mid-flush)", () => {
  it("reverts inflight ops to pending and the record to queued, then rethrows", async () => {
    const rec = buildRecord({ id: "rt", syncStatus: "queued" });
    await db.applicationRecords.put(rec);
    await db.outbox.add(
      buildOutboxOp({ recordId: "rt", kind: "create_draft", payload: rec as unknown as Record<string, unknown> })
    );
    const failing: SyncTransport = {
      async syncBatch() {
        throw new Error("network down");
      },
    };

    await expect(flushOutbox(failing)).rejects.toThrow(/network down/);

    expect((await db.outbox.where("recordId").equals("rt").first())?.status).toBe("pending");
    expect((await db.applicationRecords.get("rt"))?.syncStatus).toBe("queued");
  });
});

async function firstOpId(recordId: string): Promise<string> {
  const op = await db.outbox.where("recordId").equals(recordId).first();
  return op!.opId;
}
