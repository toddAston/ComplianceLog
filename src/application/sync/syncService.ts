import { db } from "../../db/fieldlogDb";
import type { ApplicationRecord } from "../../domain/types";
import {
  getPendingOperations,
  markFailed,
  markInflight,
  markPending,
  removeOp,
} from "./outbox";
import type { SyncOperation, SyncTransport } from "./transport";

const now = () => new Date().toISOString();
const MAX_BATCH = 100;

export type FlushSummary = {
  processed: number;
  applied: number;
  conflicts: number;
  rejected: number;
  skipped?: boolean;
};

// Module-level single-flight guard: overlapping flushes (online event + interval +
// manual click firing together) collapse to one in-flight batch.
let flushing = false;

// Drains the outbox to the server (loopback or HTTP) and reconciles results into Dexie:
//   applied  → adopt the server record, mark synced, drop the op
//   conflict → stash the server copy in serverShadow, mark sync_failed (rebase needed)
//   rejected → mark sync_failed with the server's reason
// A transport throw (network down) reverts the batch to queued/pending for later retry.
export async function flushOutbox(
  transport: SyncTransport,
  opts: { idempotencyKey?: string } = {}
): Promise<FlushSummary> {
  if (flushing) {
    return { processed: 0, applied: 0, conflicts: 0, rejected: 0, skipped: true };
  }
  flushing = true;
  try {
    const pending = await getPendingOperations();
    if (pending.length === 0) {
      return { processed: 0, applied: 0, conflicts: 0, rejected: 0 };
    }
    const batch = pending.slice(0, MAX_BATCH);

    await db.transaction("rw", db.outbox, db.applicationRecords, async () => {
      for (const op of batch) {
        await markInflight(op.opId);
        const rec = await db.applicationRecords.get(op.recordId);
        if (rec) {
          await db.applicationRecords.update(op.recordId, { syncStatus: "syncing" });
        }
      }
    });

    const operations: SyncOperation[] = batch.map((op) => ({
      opId: op.opId,
      kind: op.kind,
      recordId: op.recordId,
      baseEtag: op.baseEtag,
      payload: op.payload,
    }));
    const idempotencyKey = opts.idempotencyKey ?? crypto.randomUUID();

    let response;
    try {
      response = await transport.syncBatch({ operations }, { idempotencyKey });
    } catch (err) {
      // Network/transport failure: undo the inflight marking so the next flush retries.
      await db.transaction("rw", db.outbox, db.applicationRecords, async () => {
        for (const op of batch) {
          await markPending(op.opId);
          const rec = await db.applicationRecords.get(op.recordId);
          if (rec && rec.syncStatus === "syncing") {
            await db.applicationRecords.update(op.recordId, { syncStatus: "queued" });
          }
        }
      });
      throw err;
    }

    let applied = 0;
    let conflicts = 0;
    let rejected = 0;

    await db.transaction("rw", db.outbox, db.applicationRecords, async () => {
      for (const result of response.results) {
        const op = batch.find((o) => o.opId === result.opId);
        if (!op) continue;

        if (result.outcome === "applied") {
          applied += 1;
          await removeOp(op.opId);
          if (result.record) {
            await db.applicationRecords.put(adoptServerRecord(result.record));
          } else {
            await db.applicationRecords.update(op.recordId, {
              syncStatus: "synced",
              lastSyncedAt: now(),
              syncError: undefined,
            });
          }
        } else if (result.outcome === "conflict") {
          conflicts += 1;
          await markFailed(op, result.error?.message ?? "conflict");
          await db.applicationRecords.update(op.recordId, {
            syncStatus: "sync_failed",
            syncError: result.error?.message ?? "Server has a newer version.",
            serverShadow: result.record,
          });
        } else {
          rejected += 1;
          await markFailed(op, result.error?.message ?? "rejected");
          await db.applicationRecords.update(op.recordId, {
            syncStatus: "sync_failed",
            syncError: result.error?.message ?? "Server rejected the change.",
          });
        }
      }
    });

    return { processed: batch.length, applied, conflicts, rejected };
  } finally {
    flushing = false;
  }
}

function adoptServerRecord(server: ApplicationRecord): ApplicationRecord {
  return {
    ...server,
    syncStatus: "synced",
    lastSyncedAt: now(),
    syncError: undefined,
    serverShadow: undefined,
  };
}

// Conflict resolution: the client abandons its stale local change and adopts the
// server's copy (stashed in serverShadow). The failed/pending ops for this record are
// dropped because they targeted a version the server no longer has.
export async function adoptServerCopy(recordId: string): Promise<void> {
  await db.transaction("rw", db.applicationRecords, db.outbox, async () => {
    const rec = await db.applicationRecords.get(recordId);
    if (!rec) return;
    const shadow = rec.serverShadow as ApplicationRecord | undefined;
    const ops = await db.outbox.where("recordId").equals(recordId).toArray();
    if (ops.length > 0) await db.outbox.bulkDelete(ops.map((o) => o.opId));
    if (shadow) {
      await db.applicationRecords.put(adoptServerRecord(shadow));
    } else {
      await db.applicationRecords.update(recordId, {
        syncStatus: "synced",
        syncError: undefined,
        serverShadow: undefined,
      });
    }
  });
}

// Re-arm a failed record for the next flush (used for rejected ops the user has since
// addressed, or transient failures). Requeues its failed ops and clears the error.
export async function retryRecordSync(recordId: string): Promise<void> {
  await db.transaction("rw", db.applicationRecords, db.outbox, async () => {
    const ops = await db.outbox.where("recordId").equals(recordId).toArray();
    for (const op of ops) {
      if (op.status === "failed") {
        await db.outbox.update(op.opId, { status: "pending", updatedAt: now() });
      }
    }
    await db.applicationRecords.update(recordId, {
      syncStatus: "queued",
      syncError: undefined,
      serverShadow: undefined,
    });
  });
}
