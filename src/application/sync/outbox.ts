import { db } from "../../db/fieldlogDb";
import type { OutboxOperation, SyncOperationKind } from "../../domain/types";

// The outbox is the durable, replay-safe queue of mutations awaiting sync. Lifecycle
// services append ops in the SAME Dexie transaction that mutates the record, so a
// crash can never leave a record changed without a queued op (or vice versa).

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export type NewOutboxOp = {
  recordId: string;
  kind: SyncOperationKind;
  baseEtag?: string;
  payload?: Record<string, unknown>;
};

// Pure builder — callers add the returned row inside their own transaction.
export function buildOutboxOp(input: NewOutboxOp): OutboxOperation {
  const ts = now();
  return {
    opId: newId(),
    idempotencyKey: newId(),
    recordId: input.recordId,
    kind: input.kind,
    status: "pending",
    baseEtag: input.baseEtag,
    payload: input.payload,
    attempts: 0,
    createdAt: ts,
    updatedAt: ts,
  };
}

// Pending = anything not yet confirmed by the server: fresh (pending) or previously
// failed/conflicted (failed). Ordered oldest-first so dependent ops (create before
// submit) replay in the order they were captured.
export async function getPendingOperations(): Promise<OutboxOperation[]> {
  const ops = await db.outbox
    .where("status")
    .anyOf(["pending", "failed"])
    .toArray();
  return ops.sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  );
}

export async function markInflight(opId: string): Promise<void> {
  await db.outbox.update(opId, { status: "inflight", updatedAt: now() });
}

export async function markPending(opId: string): Promise<void> {
  await db.outbox.update(opId, { status: "pending", updatedAt: now() });
}

// Applied ops are removed — the server is now the source of truth for that change.
export async function removeOp(opId: string): Promise<void> {
  await db.outbox.delete(opId);
}

export async function markFailed(
  op: OutboxOperation,
  error: string
): Promise<void> {
  await db.outbox.update(op.opId, {
    status: "failed",
    attempts: op.attempts + 1,
    lastError: error,
    updatedAt: now(),
  });
}
