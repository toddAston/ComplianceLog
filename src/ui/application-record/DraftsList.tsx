import { useState } from "react";
import { useAllApplicationRecords } from "../../db/queries";
import {
  acceptAndLockApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";

const DEMO_APPLICATOR: ActorContext = {
  userId: "user-demo-applicator",
  displayName: "Demo Applicator",
};

const DEMO_MANAGER: ActorContext = {
  userId: "user-demo-manager",
  displayName: "Demo Manager",
};

type RowState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "locking" }
  | { kind: "error"; message: string };

export function DraftsList() {
  const records = useAllApplicationRecords();
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const clearRowState = (recordId: string) => {
    setRowState((prev) => {
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
  };

  const setRowError = (recordId: string, err: unknown) => {
    setRowState((prev) => ({
      ...prev,
      [recordId]: {
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      },
    }));
  };

  const onSubmit = async (recordId: string) => {
    setRowState((prev) => ({ ...prev, [recordId]: { kind: "submitting" } }));
    try {
      await submitApplicationRecord(recordId, DEMO_APPLICATOR);
      clearRowState(recordId);
    } catch (err) {
      setRowError(recordId, err);
    }
  };

  const onLock = async (recordId: string) => {
    setRowState((prev) => ({ ...prev, [recordId]: { kind: "locking" } }));
    const notes = reviewNotes[recordId]?.trim();
    try {
      await acceptAndLockApplicationRecord(
        recordId,
        DEMO_MANAGER,
        notes ? notes : undefined
      );
      clearRowState(recordId);
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
    } catch (err) {
      setRowError(recordId, err);
    }
  };

  if (records.length === 0) {
    return <p style={{ color: "#888" }}>No records yet.</p>;
  }

  return (
    <ul style={{ listStyle: "none", paddingLeft: 0 }}>
      {records.map((r) => {
        const state = rowState[r.id] ?? { kind: "idle" };
        const isDraft = r.workflowStatus === "draft";
        const isPendingReview = r.workflowStatus === "pending_review";
        const attestationConfirmed = r.contractorInputs.attestationConfirmed;
        const canSubmit = isDraft && attestationConfirmed;
        const notesValue = reviewNotes[r.id] ?? "";

        return (
          <li
            key={r.id}
            style={{
              border: "1px solid #eee",
              padding: "0.5rem 0.75rem",
              marginBottom: "0.4rem",
            }}
          >
            <div>
              <code style={{ color: "#888" }}>{r.id.slice(0, 8)}</code>
              {" — "}
              {r.contractorInputs.fieldName} /{" "}
              {r.contractorInputs.productName} —{" "}
              <span data-testid={`workflow-${r.id}`}>{r.workflowStatus}</span>
              {" / "}
              <span data-testid={`sync-${r.id}`}>{r.syncStatus}</span>
            </div>

            {isDraft && (
              <div style={{ marginTop: "0.4rem" }}>
                <button
                  type="button"
                  onClick={() => onSubmit(r.id)}
                  disabled={!canSubmit || state.kind === "submitting"}
                  style={{
                    padding: "0.3rem 0.7rem",
                    fontSize: "0.9rem",
                    cursor:
                      !canSubmit || state.kind === "submitting"
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {state.kind === "submitting" ? "Submitting…" : "Submit"}
                </button>
                {!attestationConfirmed && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.8rem",
                      color: "#666",
                    }}
                  >
                    Attestation required to submit.
                  </span>
                )}
                {state.kind === "error" && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.8rem",
                      color: "#b00020",
                    }}
                  >
                    {state.message}
                  </span>
                )}
              </div>
            )}

            {isPendingReview && (
              <div style={{ marginTop: "0.4rem" }}>
                <label
                  htmlFor={`review-notes-${r.id}`}
                  style={{ fontSize: "0.85rem", marginRight: "0.4rem" }}
                >
                  Review notes
                </label>
                <input
                  id={`review-notes-${r.id}`}
                  type="text"
                  value={notesValue}
                  onChange={(e) =>
                    setReviewNotes((prev) => ({
                      ...prev,
                      [r.id]: e.target.value,
                    }))
                  }
                  disabled={state.kind === "locking"}
                  placeholder="Optional"
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.2rem 0.4rem",
                    marginRight: "0.5rem",
                    minWidth: "10rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => onLock(r.id)}
                  disabled={state.kind === "locking"}
                  style={{
                    padding: "0.3rem 0.7rem",
                    fontSize: "0.9rem",
                    cursor: state.kind === "locking" ? "not-allowed" : "pointer",
                  }}
                >
                  {state.kind === "locking" ? "Locking…" : "Lock"}
                </button>
                {state.kind === "error" && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.8rem",
                      color: "#b00020",
                    }}
                  >
                    {state.message}
                  </span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
