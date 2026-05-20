import type { ApplicationRecord, SyncOperationKind } from "../../domain/types";

// Wire contract for syncing the outbox. Mirrors docs/architecture/api/openapi.yaml
// (SyncOperation / SyncBatchRequest / SyncBatchResponse / SyncOperationResult). Two
// implementations satisfy it: loopbackTransport (in-memory, for tests + offline demo)
// and httpTransport (real server). The rest of the app depends only on this interface.

export type SyncOutcome = "applied" | "conflict" | "rejected";

export type SyncOperation = {
  opId: string;
  kind: SyncOperationKind;
  recordId: string;
  // The ETag the client last saw. Omitted when the record was never synced — the
  // server then skips the optimistic-concurrency check and relies on lifecycle rules.
  baseEtag?: string;
  // create_draft: the full draft ApplicationRecord. update_inputs/resubmit: a partial
  // contractorInputs patch. submit: omitted.
  payload?: Record<string, unknown>;
};

export type SyncError = { code: string; message: string };

export type SyncOperationResult = {
  opId: string;
  outcome: SyncOutcome;
  record?: ApplicationRecord;
  error?: SyncError;
};

export type SyncBatchRequest = { operations: SyncOperation[] };
export type SyncBatchResponse = { results: SyncOperationResult[] };

export type SyncRequestOptions = {
  idempotencyKey: string;
  token?: string;
};

export interface SyncTransport {
  syncBatch(
    request: SyncBatchRequest,
    options: SyncRequestOptions
  ): Promise<SyncBatchResponse>;
}
