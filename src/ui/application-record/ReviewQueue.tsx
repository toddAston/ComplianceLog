import { useState, type KeyboardEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
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
import { SyncStatusChip } from "../system/SyncStatusChip";
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
  const [filterText, setFilterText] = useState("");
  const baseQueue = allRecords
    .filter((r) => REVIEW_STATUSES.includes(r.workflowStatus))
    .slice()
    .sort(
      (a, b) =>
        new Date(a.system.createdAt).getTime() -
        new Date(b.system.createdAt).getTime()
    );

  const pendingCount = baseQueue.filter(
    (r) => r.workflowStatus !== "needs_correction"
  ).length;
  const correctionCount = baseQueue.filter(
    (r) => r.workflowStatus === "needs_correction"
  ).length;

  const normalizedFilter = filterText.trim().toLowerCase();
  const queue = normalizedFilter
    ? baseQueue.filter((r) => {
        const ci = r.contractorInputs;
        return (
          ci.applicatorName.toLowerCase().includes(normalizedFilter) ||
          ci.farmName.toLowerCase().includes(normalizedFilter) ||
          ci.fieldName.toLowerCase().includes(normalizedFilter) ||
          ci.productName.toLowerCase().includes(normalizedFilter)
        );
      })
    : baseQueue;

  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [correctionNotes, setCorrectionNotes] = useState<
    Record<string, string>
  >({});
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [pendingLockId, setPendingLockId] = useState<string | null>(null);

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

  const isEmptyBeforeFilter = baseQueue.length === 0;
  const isFilteredEmpty = !isEmptyBeforeFilter && queue.length === 0;

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          mb: 1.5,
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
        }}
        data-testid="review-queue-header"
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            color="info"
            label={
              <span data-testid="queue-count-pending">
                {pendingCount} pending
              </span>
            }
          />
          <Chip
            size="small"
            color="warning"
            variant={correctionCount > 0 ? "filled" : "outlined"}
            label={
              <span data-testid="queue-count-correction">
                {correctionCount} needs correction
              </span>
            }
          />
        </Stack>
        <TextField
          size="small"
          placeholder="Filter by applicator, farm, field, or product"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          disabled={isEmptyBeforeFilter}
          slotProps={{
            input: { "aria-label": "Filter review queue" },
          }}
          sx={{ minWidth: { xs: "100%", sm: "20rem" } }}
          data-testid="review-queue-filter"
        />
      </Stack>

      {isEmptyBeforeFilter && (
        <Alert severity="info" data-testid="review-queue-empty">
          No records waiting for review.
        </Alert>
      )}
      {isFilteredEmpty && (
        <Alert severity="info" data-testid="review-queue-filtered-empty">
          No records match "{filterText}".
        </Alert>
      )}

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

          const openDetails = () => setSelectedRecordId(r.id);
          const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDetails();
            }
          };

          return (
            <Box component="li" key={r.id} sx={{ listStyle: "none" }}>
              <Card
                variant="outlined"
                data-testid={`queue-row-${r.id}`}
                role="button"
                tabIndex={0}
                aria-label={`Open details for record ${r.id.slice(0, 8)}`}
                onClick={openDetails}
                onKeyDown={onRowKeyDown}
                sx={{ bgcolor: "background.paper", cursor: "pointer" }}
              >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      mb: 1,
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="subtitle2"
                        component="h4"
                        sx={{ fontWeight: 600, lineHeight: 1.3 }}
                      >
                        {r.contractorInputs.fieldName}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.3 }}
                      >
                        {r.contractorInputs.productName}
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Chip
                        size="small"
                        label={
                          <span data-testid={`queue-workflow-${r.id}`}>
                            {r.workflowStatus}
                          </span>
                        }
                        color={workflowChipColor(r.workflowStatus)}
                      />
                      <SyncStatusChip
                        status={r.syncStatus}
                        recordId={r.id}
                      />
                      {issueCount > 0 && (
                        <Chip
                          size="small"
                          color={blockedCount > 0 ? "error" : "warning"}
                          label={`${issueCount} issue${issueCount === 1 ? "" : "s"}`}
                        />
                      )}
                    </Stack>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{
                      mb: 1.5,
                      flexWrap: "wrap",
                      rowGap: 0.25,
                      color: "text.secondary",
                    }}
                  >
                    <Typography variant="caption">
                      {r.contractorInputs.applicatorName}
                    </Typography>
                    <Typography variant="caption">·</Typography>
                    <Typography variant="caption">
                      {r.contractorInputs.farmName}
                    </Typography>
                    <Typography variant="caption">·</Typography>
                    <Typography variant="caption">
                      Applied {r.contractorInputs.applicationDate}
                    </Typography>
                    <Typography variant="caption">·</Typography>
                    <Typography variant="caption">
                      Submitted{" "}
                      {r.contractorInputs.submittedAt
                        ? new Date(
                            r.contractorInputs.submittedAt
                          ).toLocaleString()
                        : "—"}
                    </Typography>
                  </Stack>

                  <Divider sx={{ mb: 1.5 }} />

                  {r.workflowStatus === "needs_correction" ? (
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{
                        alignItems: { xs: "stretch", sm: "center" },
                        justifyContent: "space-between",
                      }}
                    >
                      <Alert
                        severity="warning"
                        sx={{ flex: 1, py: 0.25 }}
                      >
                        Waiting on contractor to resubmit.
                        {r.managerInputs.reviewNotes
                          ? ` Last note: "${r.managerInputs.reviewNotes}"`
                          : ""}
                      </Alert>
                      <Button
                        size="small"
                        variant="text"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecordId(r.id);
                        }}
                      >
                        Details
                      </Button>
                    </Stack>
                  ) : (
                    <Stack spacing={1.5} onClick={(e) => e.stopPropagation()}>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "1fr 1fr",
                          },
                        }}
                      >
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            fullWidth
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
                          />
                          <Button
                            size="small"
                            variant="contained"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingLockId(r.id);
                            }}
                            disabled={state.kind === "locking"}
                            data-testid={`queue-lock-${r.id}`}
                          >
                            {state.kind === "locking" ? "Locking…" : "Lock"}
                          </Button>
                        </Stack>
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            fullWidth
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
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRequestCorrection(r.id);
                            }}
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
                      </Box>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "flex-end" }}
                      >
                        <Button
                          size="small"
                          variant="text"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecordId(r.id);
                          }}
                        >
                          Details
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
      <LockConfirmDialog
        record={
          pendingLockId
            ? queue.find((r) => r.id === pendingLockId) ?? null
            : null
        }
        reviewNote={pendingLockId ? reviewNotes[pendingLockId] : ""}
        confirming={
          pendingLockId
            ? (rowState[pendingLockId]?.kind ?? "idle") === "locking"
            : false
        }
        onCancel={() => setPendingLockId(null)}
        onConfirm={async () => {
          if (!pendingLockId) return;
          const id = pendingLockId;
          // Close the confirm dialog optimistically; the row's lock button shows
          // its own progress state via rowState[id].kind.
          setPendingLockId(null);
          await onLock(id);
        }}
      />
    </>
  );
}

function LockConfirmDialog({
  record,
  reviewNote,
  confirming,
  onCancel,
  onConfirm,
}: {
  record: ApplicationRecord | null;
  reviewNote?: string;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const open = record !== null;
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="lock-confirm-title"
      aria-describedby="lock-confirm-desc"
      data-testid="lock-confirm-dialog"
    >
      <DialogTitle id="lock-confirm-title">Lock this record?</DialogTitle>
      <DialogContent>
        <DialogContentText id="lock-confirm-desc" component="div">
          Locking permanently freezes the record. Contractor edits will no
          longer be possible. Use <strong>Request correction</strong> instead if
          anything still needs to change.
        </DialogContentText>
        {record && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {record.contractorInputs.fieldName} —{" "}
              {record.contractorInputs.productName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {record.contractorInputs.applicatorName} ·{" "}
              {record.contractorInputs.farmName} ·{" "}
              {record.contractorInputs.applicationDate}
            </Typography>
            {reviewNote && reviewNote.trim().length > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Review note:</strong> {reviewNote}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} data-testid="lock-confirm-cancel">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={onConfirm}
          disabled={confirming}
          data-testid="lock-confirm-accept"
        >
          {confirming ? "Locking…" : "Lock permanently"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
