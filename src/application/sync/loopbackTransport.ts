import type {
  ApplicationRecord,
  ContractorInputs,
} from "../../domain/types";
import { runAllComplianceChecks } from "../complianceRules";
import type {
  SyncBatchRequest,
  SyncBatchResponse,
  SyncOperation,
  SyncOperationResult,
  SyncTransport,
} from "./transport";

// In-memory stand-in for the real server. It faithfully models the semantics the
// client depends on — ETag optimistic concurrency, idempotent replay, lifecycle
// reconciliation, and server-side compliance re-checks — so the whole sync stack is
// unit-testable and demoable offline→online before any backend exists.
//
// Frozen records (locked/exported) reject mutations; a stale baseEtag yields a
// conflict; a server-side lifecycle change (e.g. a manager correction) makes a stale
// client op lose. Swap this for httpTransport when server/ is deployed.

const newEtag = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export type LoopbackTransport = SyncTransport & {
  /** Test/demo helper: read the server's current copy of a record. */
  getServerRecord(recordId: string): ApplicationRecord | undefined;
  /** Test/demo helper: seed or overwrite the server's copy of a record. */
  setServerRecord(record: ApplicationRecord): void;
  /** Test/demo helper: wipe all server state. */
  reset(): void;
};

const FROZEN = new Set<ApplicationRecord["workflowStatus"]>(["locked", "exported"]);

export function createLoopbackTransport(
  seed: ReadonlyArray<ApplicationRecord> = []
): LoopbackTransport {
  const store = new Map<string, ApplicationRecord>();
  for (const r of seed) store.set(r.id, { ...r });

  const applied = (record: ApplicationRecord): SyncOperationResult => ({
    opId: "",
    outcome: "applied",
    record: { ...record },
  });
  const conflict = (
    record: ApplicationRecord,
    message: string
  ): SyncOperationResult => ({
    opId: "",
    outcome: "conflict",
    record: { ...record },
    error: { code: "CONFLICT_STALE_RECORD", message },
  });
  const rejected = (code: string, message: string): SyncOperationResult => ({
    opId: "",
    outcome: "rejected",
    error: { code, message },
  });

  const etagMismatch = (op: SyncOperation, record: ApplicationRecord): boolean =>
    op.baseEtag !== undefined && op.baseEtag !== record.etag;

  function processOp(op: SyncOperation): SyncOperationResult {
    if (op.kind === "create_draft") {
      const existing = store.get(op.recordId);
      if (existing) return { ...applied(existing), opId: op.opId }; // idempotent
      const draft = op.payload as unknown as ApplicationRecord | undefined;
      if (!draft || !draft.contractorInputs) {
        return { ...rejected("VALIDATION_FAILED", "create_draft payload missing record."), opId: op.opId };
      }
      const stored: ApplicationRecord = {
        ...draft,
        etag: newEtag(),
        syncStatus: "synced",
        syncError: undefined,
        serverShadow: undefined,
      };
      store.set(stored.id, stored);
      return { ...applied(stored), opId: op.opId };
    }

    const record = store.get(op.recordId);
    if (!record) {
      return { ...rejected("NOT_FOUND", "Application record not found on server."), opId: op.opId };
    }
    if (FROZEN.has(record.workflowStatus)) {
      return { ...rejected("RECORD_LOCKED", `Record is ${record.workflowStatus} and immutable.`), opId: op.opId };
    }
    if (etagMismatch(op, record)) {
      return { ...conflict(record, "Server has a newer version of this record."), opId: op.opId };
    }

    if (op.kind === "update_inputs") {
      const patch = (op.payload ?? {}) as Partial<ContractorInputs>;
      const next: ApplicationRecord = {
        ...record,
        contractorInputs: { ...record.contractorInputs, ...patch },
        etag: newEtag(),
        system: { ...record.system, lastUpdatedAt: now() },
      };
      store.set(next.id, next);
      return { ...applied(next), opId: op.opId };
    }

    if (op.kind === "submit") {
      if (record.workflowStatus !== "draft") {
        return { ...rejected("STATUS_TRANSITION_INVALID", "Only draft records can be submitted."), opId: op.opId };
      }
      if (!record.contractorInputs.attestationConfirmed) {
        return { ...rejected("VALIDATION_FAILED", "Attestation must be confirmed before submission."), opId: op.opId };
      }
      const blocked = runAllComplianceChecks(record).find(
        (o) => o.status === "fail" && o.severity === "blocked"
      );
      if (blocked) {
        return { ...rejected("VALIDATION_FAILED", blocked.message), opId: op.opId };
      }
      const submittedAt = now();
      const next: ApplicationRecord = {
        ...record,
        workflowStatus: "pending_review",
        syncStatus: "synced",
        productSnapshotId: record.productSnapshotId ?? crypto.randomUUID(),
        etag: newEtag(),
        contractorInputs: {
          ...record.contractorInputs,
          submittedAt,
        },
        system: { ...record.system, lastUpdatedAt: submittedAt },
      };
      store.set(next.id, next);
      return { ...applied(next), opId: op.opId };
    }

    // resubmit
    if (record.workflowStatus !== "needs_correction") {
      return { ...rejected("STATUS_TRANSITION_INVALID", "Only records needing correction can be resubmitted."), opId: op.opId };
    }
    const patch = (op.payload ?? {}) as Partial<ContractorInputs>;
    const candidate: ApplicationRecord = {
      ...record,
      contractorInputs: { ...record.contractorInputs, ...patch },
    };
    const blocked = runAllComplianceChecks(candidate).find(
      (o) => o.status === "fail" && o.severity === "blocked"
    );
    if (blocked) {
      return { ...rejected("VALIDATION_FAILED", blocked.message), opId: op.opId };
    }
    const resubmittedAt = now();
    const next: ApplicationRecord = {
      ...candidate,
      workflowStatus: "pending_review",
      syncStatus: "synced",
      etag: newEtag(),
      managerInputs: { reviewStatus: "not_reviewed" },
      system: { ...record.system, lastUpdatedAt: resubmittedAt },
    };
    store.set(next.id, next);
    return { ...applied(next), opId: op.opId };
  }

  return {
    async syncBatch(request: SyncBatchRequest): Promise<SyncBatchResponse> {
      return { results: request.operations.map(processOp) };
    },
    getServerRecord(recordId) {
      const r = store.get(recordId);
      return r ? { ...r } : undefined;
    },
    setServerRecord(record) {
      store.set(record.id, { ...record });
    },
    reset() {
      store.clear();
    },
  };
}
