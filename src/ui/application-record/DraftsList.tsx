import { useState } from "react";
import { useAllApplicationRecords } from "../../db/queries";
import {
  acceptAndLockApplicationRecord,
  requestCorrectionForApplicationRecord,
  submitApplicationRecord,
} from "../../application/applicationRecordService";
import {
  exportLockedApplicationRecord,
  type LockedApplicationRecordExport,
} from "../../application/applicationRecordExport";
import { DEMO_APPLICATOR_ACTOR, DEMO_MANAGER_ACTOR } from "../demoSession";

type RowState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "locking" }
  | { kind: "requesting_correction" }
  | { kind: "exporting" }
  | { kind: "exported"; dto: LockedApplicationRecordExport }
  | { kind: "error"; message: string };

export function DraftsList() {
  const records = useAllApplicationRecords();
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [correctionNotes, setCorrectionNotes] = useState<
    Record<string, string>
  >({});

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
      await submitApplicationRecord(recordId, DEMO_APPLICATOR_ACTOR);
      clearRowState(recordId);
    } catch (err) {
      setRowError(recordId, err);
    }
  };

  const onViewExport = async (recordId: string) => {
    setRowState((prev) => ({ ...prev, [recordId]: { kind: "exporting" } }));
    try {
      const dto = await exportLockedApplicationRecord(recordId);
      setRowState((prev) => ({
        ...prev,
        [recordId]: { kind: "exported", dto },
      }));
    } catch (err) {
      setRowError(recordId, err);
    }
  };

  const onCloseExport = (recordId: string) => {
    clearRowState(recordId);
  };

  const onRequestCorrection = async (recordId: string) => {
    const notes = correctionNotes[recordId]?.trim();
    if (!notes) return;
    setRowState((prev) => ({
      ...prev,
      [recordId]: { kind: "requesting_correction" },
    }));
    try {
      await requestCorrectionForApplicationRecord(
        recordId,
        DEMO_MANAGER_ACTOR,
        notes
      );
      clearRowState(recordId);
      setCorrectionNotes((prev) => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
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
        DEMO_MANAGER_ACTOR,
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
        const isLocked = r.workflowStatus === "locked";
        const attestationConfirmed = r.contractorInputs.attestationConfirmed;
        const canSubmit = isDraft && attestationConfirmed;
        const notesValue = reviewNotes[r.id] ?? "";
        const correctionNotesValue = correctionNotes[r.id] ?? "";
        const canRequestCorrection =
          isPendingReview && correctionNotesValue.trim().length > 0;

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

            {isLocked && (
              <div style={{ marginTop: "0.4rem" }}>
                {state.kind !== "exported" && (
                  <button
                    type="button"
                    onClick={() => onViewExport(r.id)}
                    disabled={state.kind === "exporting"}
                    style={{
                      padding: "0.3rem 0.7rem",
                      fontSize: "0.9rem",
                      cursor:
                        state.kind === "exporting" ? "not-allowed" : "pointer",
                    }}
                  >
                    {state.kind === "exporting"
                      ? "Loading…"
                      : "View export"}
                  </button>
                )}
                {state.kind === "exported" && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.4rem",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "#555" }}>
                        Evidence export (audit packet — not a legal authorization
                        certificate)
                      </span>
                      <button
                        type="button"
                        onClick={() => onCloseExport(r.id)}
                        style={{
                          padding: "0.2rem 0.5rem",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Close
                      </button>
                    </div>
                    <pre
                      data-testid={`export-${r.id}`}
                      style={{
                        fontSize: "0.75rem",
                        background: "#f7f7f7",
                        border: "1px solid #eee",
                        padding: "0.5rem",
                        overflowX: "auto",
                        maxHeight: "20rem",
                      }}
                    >
                      {JSON.stringify(state.dto, null, 2)}
                    </pre>
                  </>
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
                <div style={{ marginTop: "0.4rem" }}>
                  <label
                    htmlFor={`correction-notes-${r.id}`}
                    style={{ fontSize: "0.85rem", marginRight: "0.4rem" }}
                  >
                    Correction notes
                  </label>
                  <input
                    id={`correction-notes-${r.id}`}
                    type="text"
                    value={correctionNotesValue}
                    onChange={(e) =>
                      setCorrectionNotes((prev) => ({
                        ...prev,
                        [r.id]: e.target.value,
                      }))
                    }
                    disabled={state.kind === "requesting_correction"}
                    placeholder="Required to request corrections"
                    style={{
                      fontSize: "0.85rem",
                      padding: "0.2rem 0.4rem",
                      marginRight: "0.5rem",
                      minWidth: "12rem",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onRequestCorrection(r.id)}
                    disabled={
                      !canRequestCorrection ||
                      state.kind === "requesting_correction"
                    }
                    style={{
                      padding: "0.3rem 0.7rem",
                      fontSize: "0.9rem",
                      cursor:
                        !canRequestCorrection ||
                        state.kind === "requesting_correction"
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {state.kind === "requesting_correction"
                      ? "Requesting…"
                      : "Request correction"}
                  </button>
                </div>
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
