import { AppError } from "./errors";
import type { WorkflowStatus } from "../../../src/domain/types";

// Application-layer mirror of the DB triggers in migrations/0001. The database is
// the ultimate enforcer (the client can be tampered with), but checking here lets
// us return a clean 409/422 instead of surfacing a raw trigger exception.

// Both the doc-canonical path and the client shortcuts (draft→pending_review,
// pending_review→locked) are permitted — see Divergences in api_architecture.md.
const ALLOWED_TRANSITIONS: ReadonlySet<string> = new Set([
  "draft>submitted",
  "draft>pending_review",
  "draft>needs_correction",
  "submitted>pending_review",
  "pending_review>accepted",
  "pending_review>needs_correction",
  "pending_review>locked",
  "accepted>locked",
  "needs_correction>pending_review",
  "needs_correction>draft",
  "locked>exported",
]);

const FROZEN: ReadonlySet<WorkflowStatus> = new Set(["locked", "exported"]);

export function isFrozen(status: WorkflowStatus): boolean {
  return FROZEN.has(status);
}

export function isAllowedTransition(
  from: WorkflowStatus,
  to: WorkflowStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS.has(`${from}>${to}`);
}

// Guards a content mutation (edit/patch). Locked and exported records are frozen.
export function assertMutable(status: WorkflowStatus, recordId: string): void {
  if (isFrozen(status)) {
    throw new AppError(
      "RECORD_LOCKED",
      `Record ${recordId} is ${status} and immutable.`
    );
  }
}

// Guards a workflow_status change.
export function assertTransition(
  from: WorkflowStatus,
  to: WorkflowStatus
): void {
  if (!isAllowedTransition(from, to)) {
    throw new AppError(
      "STATUS_TRANSITION_INVALID",
      `Illegal workflow transition ${from} -> ${to}.`
    );
  }
}
