import { useState } from "react";
import { useAllApplicationRecords } from "../../db/queries";
import {
  submitApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";

const DEMO_ACTOR: ActorContext = {
  userId: "user-demo-applicator",
  displayName: "Demo Applicator",
};

type RowState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export function DraftsList() {
  const records = useAllApplicationRecords();
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  const onSubmit = async (recordId: string) => {
    setRowState((prev) => ({ ...prev, [recordId]: { kind: "submitting" } }));
    try {
      await submitApplicationRecord(recordId, DEMO_ACTOR);
      setRowState((prev) => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
    } catch (err) {
      setRowState((prev) => ({
        ...prev,
        [recordId]: {
          kind: "error",
          message: err instanceof Error ? err.message : "Unknown error.",
        },
      }));
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
        const attestationConfirmed = r.contractorInputs.attestationConfirmed;
        const canSubmit = isDraft && attestationConfirmed;

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
          </li>
        );
      })}
    </ul>
  );
}
