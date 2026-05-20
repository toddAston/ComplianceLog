import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAllApplicationRecords } from "../../db/queries";
import {
  acceptAndLockApplicationRecord,
  requestCorrectionForApplicationRecord,
} from "../../application/applicationRecordService";
import { runComplianceChecks } from "../../application/complianceRules";
import type { ApplicationRecord } from "../../domain/types";
import { useSessionActor } from "../session/SessionContext";
import { RecordDetailDialog } from "./RecordDetailDialog";

type RowState =
  | { kind: "idle" }
  | { kind: "locking" }
  | { kind: "requesting_correction" }
  | { kind: "error"; message: string };

type WorkflowChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";

const REVIEW_STATUSES: ReadonlyArray<ApplicationRecord["workflowStatus"]> = [
  "submitted",
  "pending_review",
  "needs_correction",
];

function workflowChipColor(
  status: ApplicationRecord["workflowStatus"]
): WorkflowChipColor {
  switch (status) {
    case "pending_review":
      return "info";
    case "needs_correction":
      return "warning";
    case "submitted":
      return "info";
    default:
      return "default";
  }
}

export function ReviewQueue() {
  const actor = useSessionActor();
  const allRecords = useAllApplicationRecords();
  const queue = allRecords
    .filter((r) => REVIEW_STATUSES.includes(r.workflowStatus))
    .slice()
    .sort(
      (a, b) =>
        new Date(a.system.createdAt).getTime() -
        new Date(b.system.createdAt).getTime()
    );

  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [correctionNotes, setCorrectionNotes] = useState<
    Record<string, string>
  >({});
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const clearRowState = (id: string) =>
    setRowState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const setRowError = (id: string, err: unknown) =>
    setRowState((prev) => ({
      ...prev,
      [id]: {
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      },
    }));

  const onLock = async (id: string) => {
    setRowState((prev) => ({ ...prev, [id]: { kind: "locking" } }));
    try {
      const notes = reviewNotes[id]?.trim();
      await acceptAndLockApplicationRecord(
        id,
        actor,
        notes ? notes : undefined
      );
      clearRowState(id);
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setRowError(id, err);
    }
  };

  const onRequestCorrection = async (id: string) => {
    const notes = correctionNotes[id]?.trim();
    if (!notes) return;
    setRowState((prev) => ({
      ...prev,
      [id]: { kind: "requesting_correction" },
    }));
    try {
      await requestCorrectionForApplicationRecord(id, actor, notes);
      clearRowState(id);
      setCorrectionNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setRowError(id, err);
    }
  };

  const selectedRecord = selectedRecordId
    ? queue.find((r) => r.id === selectedRecordId) ??
      allRecords.find((r) => r.id === selectedRecordId) ??
      null
    : null;

  if (queue.length === 0) {
    return (
      <Alert severity="info" data-testid="review-queue-empty">
        No records waiting for review.
      </Alert>
    );
  }

  return (
    <>
      <Stack
        component="ul"
        spacing={1.5}
        sx={{ listStyle: "none", p: 0, m: 0 }}
        data-testid="review-queue"
      >
        {queue.map((r) => {
          const state = rowState[r.id] ?? { kind: "idle" };
          const isLockable =
            r.workflowStatus === "pending_review" ||
            r.workflowStatus === "submitted";
          const correctionDraft = correctionNotes[r.id] ?? "";
          const reviewNote = reviewNotes[r.id] ?? "";
          const checks = runComplianceChecks(r);
          const issueCount = checks.length;
          const blockedCount = checks.filter(
            (c) => c.severity === "blocked"
          ).length;
          const canRequestCorrection =
            isLockable && correctionDraft.trim().length > 0;

          return (
            <Box component="li" key={r.id} sx={{ listStyle: "none" }}>
              <Card
                variant="outlined"
                data-testid={`queue-row-${r.id}`}
                sx={{ bgcolor: "background.paper" }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mb: 1, alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {r.contractorInputs.fieldName} —{" "}
                      {r.contractorInputs.productName}
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        <span data-testid={`queue-workflow-${r.id}`}>
                          {r.workflowStatus}
                        </span>
                      }
                      color={workflowChipColor(r.workflowStatus)}
                    />
                    {issueCount > 0 && (
                      <Chip
                        size="small"
                        color={blockedCount > 0 ? "error" : "warning"}
                        label={`${issueCount} issue${issueCount === 1 ? "" : "s"}`}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Submitted{" "}
                      {r.contractorInputs.submittedAt
                        ? new Date(
                            r.contractorInputs.submittedAt
                          ).toLocaleString()
                        : "—"}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setSelectedRecordId(r.id)}
                    >
                      Details
                    </Button>
                  </Stack>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 1 }}
                  >
                    {r.contractorInputs.applicatorName} ·{" "}
                    {r.contractorInputs.farmName} ·{" "}
                    {r.contractorInputs.applicationDate}
                  </Typography>

                  {r.workflowStatus === "needs_correction" ? (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      Waiting on contractor to resubmit.
                      {r.managerInputs.reviewNotes
                        ? ` Last note: "${r.managerInputs.reviewNotes}"`
                        : ""}
                    </Alert>
                  ) : (
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <TextField
                          size="small"
                          label="Review notes"
                          placeholder="Optional"
                          value={reviewNote}
                          disabled={state.kind === "locking"}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                          slotProps={{ inputLabel: { shrink: true } }}
                          sx={{ minWidth: "12rem" }}
                        />
                        <Button
                          size="small"
                          onClick={() => onLock(r.id)}
                          disabled={state.kind === "locking"}
                          data-testid={`queue-lock-${r.id}`}
                        >
                          {state.kind === "locking" ? "Locking…" : "Lock"}
                        </Button>
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <TextField
                          size="small"
                          label="Correction notes"
                          placeholder="Required to request corrections"
                          value={correctionDraft}
                          disabled={state.kind === "requesting_correction"}
                          onChange={(e) =>
                            setCorrectionNotes((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                          slotProps={{ inputLabel: { shrink: true } }}
                          sx={{ minWidth: "14rem" }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onRequestCorrection(r.id)}
                          disabled={
                            !canRequestCorrection ||
                            state.kind === "requesting_correction"
                          }
                          data-testid={`queue-correct-${r.id}`}
                        >
                          {state.kind === "requesting_correction"
                            ? "Requesting…"
                            : "Request correction"}
                        </Button>
                      </Stack>
                      {state.kind === "error" && (
                        <Alert severity="error">{state.message}</Alert>
                      )}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Stack>
      <RecordDetailDialog
        record={selectedRecord}
        onClose={() => setSelectedRecordId(null)}
      />
    </>
  );
}
