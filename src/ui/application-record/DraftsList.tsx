import { useState, type KeyboardEvent } from "react";
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
  submitApplicationRecord,
} from "../../application/applicationRecordService";
import {
  exportLockedApplicationRecord,
  type LockedApplicationRecordExport,
} from "../../application/applicationRecordExport";
import {
  downloadAuditPacketJson,
  downloadAuditPacketPdf,
} from "../../application/auditPacketDownload";
import { runComplianceChecks } from "../../application/complianceRules";
import { computeDraftSubmissionWindow } from "../../application/draftSubmissionWindow";
import type { ApplicationRecord } from "../../domain/types";
import { DEMO_APPLICATOR_ACTOR, DEMO_MANAGER_ACTOR } from "../demoSession";
import { useSessionRole } from "../session/SessionContext";
import { RecordDetailDialog } from "./RecordDetailDialog";

type RowState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "locking" }
  | { kind: "requesting_correction" }
  | { kind: "exporting" }
  | { kind: "exported"; dto: LockedApplicationRecordExport }
  | { kind: "error"; message: string };

type WorkflowChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";

function workflowChipColor(
  status: ApplicationRecord["workflowStatus"]
): WorkflowChipColor {
  switch (status) {
    case "draft":
      return "default";
    case "pending_review":
      return "info";
    case "needs_correction":
      return "warning";
    case "locked":
      return "success";
    case "exported":
      return "primary";
    default:
      return "default";
  }
}

function syncChipColor(
  status: ApplicationRecord["syncStatus"]
): WorkflowChipColor {
  switch (status) {
    case "local_only":
      return "default";
    case "queued":
      return "info";
    case "syncing":
      return "info";
    case "synced":
      return "success";
    case "sync_failed":
      return "error";
    default:
      return "default";
  }
}

export function DraftsList() {
  const role = useSessionRole();
  const showManagerAffordances = role === "manager";
  const records = useAllApplicationRecords();
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [correctionNotes, setCorrectionNotes] = useState<
    Record<string, string>
  >({});
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

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

  const onDownloadJson = async (recordId: string) => {
    try {
      await downloadAuditPacketJson(recordId);
    } catch (err) {
      setRowError(recordId, err);
    }
  };

  const onDownloadPdf = async (recordId: string) => {
    try {
      await downloadAuditPacketPdf(recordId);
    } catch (err) {
      setRowError(recordId, err);
    }
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
    return (
      <Typography color="text.secondary">No records yet.</Typography>
    );
  }

  const selectedRecord = selectedRecordId
    ? records.find((r) => r.id === selectedRecordId) ?? null
    : null;

  return (
    <>
      <Stack
        component="ul"
        spacing={1.5}
        sx={{ listStyle: "none", p: 0, m: 0 }}
      >
        {records.map((r) => {
          const state = rowState[r.id] ?? { kind: "idle" };
          const isDraft = r.workflowStatus === "draft";
          const isPendingReview = r.workflowStatus === "pending_review";
          const isLocked = r.workflowStatus === "locked";
          const isNeedsCorrection = r.workflowStatus === "needs_correction";
          const attestationConfirmed =
            r.contractorInputs.attestationConfirmed;
          const canSubmit = isDraft && attestationConfirmed;
          const notesValue = reviewNotes[r.id] ?? "";
          const correctionNotesValue = correctionNotes[r.id] ?? "";
          const canRequestCorrection =
            isPendingReview && correctionNotesValue.trim().length > 0;
          const complianceResults = runComplianceChecks(r);
          const warningCount = complianceResults.filter(
            (c) => c.severity === "warning" || c.severity === "error"
          ).length;
          const submissionWindow = isDraft
            ? computeDraftSubmissionWindow(
                r.contractorInputs.applicationDate,
                new Date()
              )
            : null;
          const showSubmissionWindowChip =
            submissionWindow !== null && submissionWindow.status !== "ok";
          const submissionChipColor: WorkflowChipColor =
            submissionWindow?.severity === "error" ? "error" : "warning";

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
                role="button"
                tabIndex={0}
                aria-label={`Open details for record ${r.id.slice(0, 8)}`}
                onClick={openDetails}
                onKeyDown={onRowKeyDown}
                sx={{ cursor: "pointer" }}
                data-testid={`draft-row-${r.id}`}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mb: 1, alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography
                      variant="caption"
                      component="code"
                      color="text.secondary"
                    >
                      {r.id.slice(0, 8)}
                    </Typography>
                    <Typography variant="body2">
                      {r.contractorInputs.fieldName} /{" "}
                      {r.contractorInputs.productName}
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        <span data-testid={`workflow-${r.id}`}>
                          {r.workflowStatus}
                        </span>
                      }
                      color={workflowChipColor(r.workflowStatus)}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={
                        <span data-testid={`sync-${r.id}`}>
                          {r.syncStatus}
                        </span>
                      }
                      color={syncChipColor(r.syncStatus)}
                    />
                    {warningCount > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        label={`⚠ ${warningCount}`}
                        title={`${warningCount} compliance issue(s)`}
                      />
                    )}
                    {showSubmissionWindowChip && submissionWindow && (
                      <Chip
                        size="small"
                        color={submissionChipColor}
                        variant={
                          submissionWindow.status === "overdue"
                            ? "filled"
                            : "outlined"
                        }
                        label={
                          <span data-testid={`draft-window-${r.id}`}>
                            {submissionWindow.label}
                          </span>
                        }
                        title="2 CSR 70-25.120(1) — records must be completed within 3 days of application."
                      />
                    )}
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

                  {isDraft && (
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubmit(r.id);
                        }}
                        disabled={
                          !canSubmit || state.kind === "submitting"
                        }
                      >
                        {state.kind === "submitting"
                          ? "Submitting…"
                          : "Submit"}
                      </Button>
                      {!attestationConfirmed && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Attestation required to submit.
                        </Typography>
                      )}
                      {state.kind === "error" && (
                        <Typography variant="caption" color="error">
                          {state.message}
                        </Typography>
                      )}
                    </Stack>
                  )}

                  {isLocked && (
                    <Stack spacing={1} onClick={(e) => e.stopPropagation()}>
                      {state.kind !== "exported" && (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewExport(r.id);
                            }}
                            disabled={state.kind === "exporting"}
                          >
                            {state.kind === "exporting"
                              ? "Loading…"
                              : "View export"}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            data-testid={`download-json-${r.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadJson(r.id);
                            }}
                          >
                            Download JSON
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            data-testid={`download-pdf-${r.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadPdf(r.id);
                            }}
                          >
                            Download PDF
                          </Button>
                        </Stack>
                      )}
                      {state.kind === "exported" && (
                        <>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center" }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Evidence export (audit packet — not a legal
                              authorization certificate)
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCloseExport(r.id);
                              }}
                            >
                              Close
                            </Button>
                          </Stack>
                          <Box
                            component="pre"
                            data-testid={`export-${r.id}`}
                            sx={{
                              fontSize: "0.75rem",
                              bgcolor: "#f7f7f7",
                              border: "1px solid #eee",
                              borderRadius: 1,
                              p: 1,
                              m: 0,
                              overflowX: "auto",
                              maxHeight: "20rem",
                            }}
                          >
                            {JSON.stringify(state.dto, null, 2)}
                          </Box>
                        </>
                      )}
                      {state.kind === "error" && (
                        <Alert severity="error">{state.message}</Alert>
                      )}
                    </Stack>
                  )}

                  {isPendingReview && showManagerAffordances && (
                    <Stack spacing={1.5} onClick={(e) => e.stopPropagation()}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <TextField
                          size="small"
                          label="Review notes"
                          value={notesValue}
                          placeholder="Optional"
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
                          onClick={(e) => {
                            e.stopPropagation();
                            onLock(r.id);
                          }}
                          disabled={state.kind === "locking"}
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
                          value={correctionNotesValue}
                          placeholder="Required to request corrections"
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
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestCorrection(r.id);
                          }}
                          disabled={
                            !canRequestCorrection ||
                            state.kind === "requesting_correction"
                          }
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

                  {isNeedsCorrection && (
                    <Typography variant="caption" color="warning.main">
                      Needs correction — click Details to resubmit.
                    </Typography>
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
