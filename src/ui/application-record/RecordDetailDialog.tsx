import { useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type {
  ApplicationRecord,
  ApplicationRecordEvent,
} from "../../domain/types";
import { useRecordEvents } from "../../db/queries";
import {
  runComplianceChecks,
  type ComplianceCheckOutcome,
  type ComplianceCheckResult,
} from "../../application/complianceRules";
import { resubmitCorrectedApplicationRecord } from "../../application/applicationRecordService";
import { DEMO_APPLICATOR_ACTOR } from "../demoSession";
import { AuditReport } from "./AuditReport";

type EventChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";

function eventChipColor(
  type: ApplicationRecordEvent["type"]
): EventChipColor {
  switch (type) {
    case "submitted":
      return "info";
    case "reviewed":
    case "accepted":
      return "primary";
    case "locked":
      return "success";
    case "exported":
      return "primary";
    case "correction_requested":
      return "warning";
    case "correction_submitted":
      return "info";
    case "sync_failed":
      return "error";
    default:
      return "default";
  }
}

type Props = {
  record: ApplicationRecord | null;
  onClose: () => void;
};

const severityColor: Record<string, string> = {
  blocked: "#b00020",
  error: "#e65100",
  warning: "#f9a825",
};

const severityIcon: Record<string, string> = {
  blocked: "✗",
  error: "✗",
  warning: "⚠",
};

const statusIcon: Record<ComplianceCheckOutcome["status"], string> = {
  pass: "✓",
  fail: "✗",
  unknown: "?",
};

const statusColor: Record<ComplianceCheckOutcome["status"], string> = {
  pass: "#2e7d32",
  fail: "#b00020",
  unknown: "#6d4c00",
};

const statusLabel: Record<ComplianceCheckOutcome["status"], string> = {
  pass: "PASS",
  fail: "FAIL",
  unknown: "UNKNOWN",
};

function isComplianceOutcomeArray(
  value: unknown
): value is ComplianceCheckOutcome[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        "ruleId" in entry &&
        "status" in entry &&
        "description" in entry
    )
  );
}

export function RecordDetailDialog({ record, onClose }: Props) {
  const events = useRecordEvents(record?.id ?? null);
  const [correctionFields, setCorrectionFields] = useState<
    Record<string, string>
  >({});
  const [resubmitState, setResubmitState] = useState<
    "idle" | "saving" | "error"
  >("idle");
  const [resubmitError, setResubmitError] = useState("");
  const [showPrint, setShowPrint] = useState(false);

  if (!record) return null;

  const complianceResults: ComplianceCheckResult[] =
    runComplianceChecks(record);
  const isNeedsCorrection = record.workflowStatus === "needs_correction";
  const isLocked = record.workflowStatus === "locked";

  const handleResubmit = async () => {
    setResubmitState("saving");
    setResubmitError("");
    try {
      await resubmitCorrectedApplicationRecord(
        record.id,
        correctionFields,
        DEMO_APPLICATOR_ACTOR
      );
      setCorrectionFields({});
      setResubmitState("idle");
      onClose();
    } catch (err) {
      setResubmitState("error");
      setResubmitError(err instanceof Error ? err.message : "Unknown error.");
    }
  };

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
    }, 100);
  };

  const ci = record.contractorInputs;

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        fullWidth
        maxWidth="md"
        className="record-detail-dialog"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          Record {record.id.slice(0, 8)}
          <Chip
            label={record.workflowStatus}
            size="small"
            sx={{ ml: 1 }}
            color={
              isLocked
                ? "success"
                : isNeedsCorrection
                  ? "warning"
                  : "default"
            }
          />
        </DialogTitle>

        <DialogContent dividers>
          {isLocked && (
            <Alert
              severity="success"
              variant="outlined"
              sx={{ mb: 2 }}
              icon={<span aria-hidden>🔒</span>}
              data-testid="locked-banner"
            >
              <AlertTitle sx={{ fontWeight: 700 }}>
                Locked — record is immutable
              </AlertTitle>
              <Stack spacing={0.25}>
                {record.system.lockedAt && (
                  <Typography variant="body2">
                    <strong>Locked at:</strong>{" "}
                    <span data-testid="locked-banner-at">
                      {new Date(record.system.lockedAt).toLocaleString()}
                    </span>
                  </Typography>
                )}
                {record.managerInputs.reviewedBy && (
                  <Typography variant="body2">
                    <strong>Locked by:</strong>{" "}
                    <span data-testid="locked-banner-by">
                      {record.managerInputs.reviewedBy}
                    </span>
                  </Typography>
                )}
                {record.managerInputs.reviewNotes && (
                  <Typography variant="body2">
                    <strong>Review notes:</strong>{" "}
                    <span data-testid="locked-banner-notes">
                      {record.managerInputs.reviewNotes}
                    </span>
                  </Typography>
                )}
              </Stack>
            </Alert>
          )}

          {/* Compliance Checks */}
          <section>
            <h3 style={{ margin: "0 0 0.5rem" }}>Compliance Checks</h3>
            {complianceResults.length === 0 ? (
              <p style={{ color: "#2e7d32", margin: 0 }}>
                ✓ All checks passed
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {complianceResults.map((r) => (
                  <li
                    key={r.ruleId}
                    style={{
                      padding: "0.3rem 0",
                      color: severityColor[r.severity],
                    }}
                  >
                    <strong>{severityIcon[r.severity]}</strong> {r.message}{" "}
                    <span
                      style={{ fontSize: "0.8rem", color: "#666" }}
                    >
                      [{r.citationShort}]
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Divider sx={{ my: 2 }} />

          {/* Contractor Inputs Summary */}
          <section>
            <h3 style={{ margin: "0 0 0.5rem" }}>Record Details</h3>
            <table
              style={{
                width: "100%",
                fontSize: "0.875rem",
                borderCollapse: "collapse",
              }}
            >
              <tbody>
                <Row label="Applicator" value={`${ci.applicatorName} (${ci.company})`} />
                <Row label="Certification #" value={ci.certificationNumber || "—"} />
                <Row label="Farm / Field" value={`${ci.farmName} / ${ci.fieldName}`} />
                <Row label="Crop/Site" value={ci.cropOrSite} />
                <Row label="Acres Treated" value={ci.acresTreated} />
                <Row label="Product" value={`${ci.productName} (EPA ${ci.epaRegistrationNumber})`} />
                <Row label="RUP" value={ci.rupStatus} />
                <Row label="Date" value={ci.applicationDate} />
                <Row label="Time" value={`${ci.startTime}${ci.endTime ? ` – ${ci.endTime}` : ""}`} />
                <Row label="Method" value={ci.applicationMethod} />
                <Row label="Rate" value={ci.rateApplied} />
                <Row label="Total Amount" value={ci.totalAmountApplied} />
                <Row label="Target Pest" value={ci.targetPest || "—"} />
                <Row label="Temperature" value={ci.temperature || "—"} />
                <Row label="Wind Speed" value={ci.windSpeed || "—"} />
                <Row label="Wind Direction" value={ci.windDirection || "—"} />
              </tbody>
            </table>
          </section>

          <Divider sx={{ my: 2 }} />

          {/* Event Timeline */}
          <Box component="section" data-testid="audit-timeline">
            <Typography variant="subtitle1" component="h3" sx={{ mb: 1 }}>
              Audit Timeline
            </Typography>
            {events.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No events recorded.
              </Typography>
            ) : (
              <Stack
                component="ol"
                spacing={1.25}
                sx={{
                  listStyle: "none",
                  m: 0,
                  pl: 2,
                  borderLeft: "2px solid",
                  borderColor: "divider",
                }}
                data-testid="audit-timeline-list"
              >
                {events.map((evt) => (
                  <Box
                    component="li"
                    key={evt.id}
                    sx={{ listStyle: "none" }}
                    data-testid={`audit-event-${evt.id}`}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Chip
                        size="small"
                        label={evt.type}
                        color={eventChipColor(evt.type)}
                        data-testid={`audit-event-type-${evt.id}`}
                      />
                      <Tooltip title={evt.occurredAt}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          data-testid={`audit-event-time-${evt.id}`}
                        >
                          {new Date(evt.occurredAt).toLocaleString()}
                        </Typography>
                      </Tooltip>
                      {evt.actorDisplayName && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          data-testid={`audit-event-actor-${evt.id}`}
                        >
                          · by {evt.actorDisplayName}
                        </Typography>
                      )}
                    </Stack>
                    {evt.message && (
                      <Typography
                        variant="body2"
                        color="text.primary"
                        sx={{ mt: 0.25 }}
                        data-testid={`audit-event-message-${evt.id}`}
                      >
                        {evt.message}
                      </Typography>
                    )}
                    {evt.type === "compliance_check_run" &&
                      isComplianceOutcomeArray(evt.metadata?.outcomes) && (
                        <Box
                          component="ul"
                          sx={{
                            listStyle: "none",
                            p: 0,
                            m: 0,
                            mt: 0.5,
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.25,
                          }}
                          data-testid={`audit-event-compliance-${evt.id}`}
                        >
                          {(evt.metadata.outcomes as ComplianceCheckOutcome[]).map(
                            (outcome) => (
                              <Box
                                component="li"
                                key={outcome.ruleId}
                                sx={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 0.75,
                                  fontSize: "0.85rem",
                                  lineHeight: 1.35,
                                }}
                                data-testid={`audit-compliance-${evt.id}-${outcome.ruleId}`}
                              >
                                <Typography
                                  component="span"
                                  sx={{
                                    fontWeight: 700,
                                    color: statusColor[outcome.status],
                                    minWidth: "1.25rem",
                                  }}
                                  aria-label={statusLabel[outcome.status]}
                                  data-testid={`audit-compliance-status-${evt.id}-${outcome.ruleId}`}
                                >
                                  {statusIcon[outcome.status]}
                                </Typography>
                                <Box sx={{ flex: 1 }}>
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{ color: statusColor[outcome.status] }}
                                  >
                                    <strong>{statusLabel[outcome.status]}</strong>{" "}
                                    — {outcome.description}
                                  </Typography>{" "}
                                  <Typography
                                    component="span"
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    [{outcome.citationShort}]
                                  </Typography>
                                  {outcome.status === "fail" && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ display: "block" }}
                                    >
                                      {outcome.message}
                                    </Typography>
                                  )}
                                  {outcome.status === "unknown" &&
                                    outcome.unknownReason && (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: "block" }}
                                      >
                                        {outcome.unknownReason}
                                      </Typography>
                                    )}
                                </Box>
                              </Box>
                            )
                          )}
                        </Box>
                      )}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {/* Correction Resubmit UI */}
          {isNeedsCorrection && (
            <>
              <Divider sx={{ my: 2 }} />
              <section>
                <h3 style={{ margin: "0 0 0.5rem" }}>Resubmit Correction</h3>
                {record.managerInputs.reviewNotes && (
                  <p
                    style={{
                      background: "#fff3e0",
                      padding: "0.5rem",
                      borderRadius: 4,
                      fontSize: "0.85rem",
                    }}
                  >
                    <strong>Manager notes:</strong>{" "}
                    {record.managerInputs.reviewNotes}
                  </p>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem",
                  }}
                >
                  <label style={{ fontSize: "0.85rem" }}>
                    Target Pest
                    <input
                      type="text"
                      value={correctionFields.targetPest ?? ci.targetPest ?? ""}
                      onChange={(e) =>
                        setCorrectionFields((f) => ({
                          ...f,
                          targetPest: e.target.value,
                        }))
                      }
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "0.3rem",
                        marginTop: "0.2rem",
                      }}
                    />
                  </label>
                  <label style={{ fontSize: "0.85rem" }}>
                    Wind Speed
                    <input
                      type="text"
                      value={correctionFields.windSpeed ?? ci.windSpeed ?? ""}
                      onChange={(e) =>
                        setCorrectionFields((f) => ({
                          ...f,
                          windSpeed: e.target.value,
                        }))
                      }
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "0.3rem",
                        marginTop: "0.2rem",
                      }}
                    />
                  </label>
                  <label style={{ fontSize: "0.85rem" }}>
                    Wind Direction
                    <input
                      type="text"
                      value={
                        correctionFields.windDirection ?? ci.windDirection ?? ""
                      }
                      onChange={(e) =>
                        setCorrectionFields((f) => ({
                          ...f,
                          windDirection: e.target.value,
                        }))
                      }
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "0.3rem",
                        marginTop: "0.2rem",
                      }}
                    />
                  </label>
                  <label style={{ fontSize: "0.85rem" }}>
                    Temperature
                    <input
                      type="text"
                      value={
                        correctionFields.temperature ?? ci.temperature ?? ""
                      }
                      onChange={(e) =>
                        setCorrectionFields((f) => ({
                          ...f,
                          temperature: e.target.value,
                        }))
                      }
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "0.3rem",
                        marginTop: "0.2rem",
                      }}
                    />
                  </label>
                </div>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={handleResubmit}
                  disabled={resubmitState === "saving"}
                >
                  {resubmitState === "saving" ? "Resubmitting…" : "Resubmit"}
                </Button>
                {resubmitState === "error" && (
                  <p style={{ color: "#b00020", fontSize: "0.8rem" }}>
                    {resubmitError}
                  </p>
                )}
              </section>
            </>
          )}
        </DialogContent>

        <DialogActions>
          {isLocked && (
            <Button onClick={handlePrint} variant="outlined" size="small">
              Print Audit Report
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Hidden print container */}
      {showPrint && record && (
        <div className="audit-report-print-container">
          <AuditReport
            record={record}
            events={events}
            complianceResults={complianceResults}
          />
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          padding: "0.2rem 0.5rem 0.2rem 0",
          fontWeight: 600,
          whiteSpace: "nowrap",
          verticalAlign: "top",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "0.2rem 0" }}>{value}</td>
    </tr>
  );
}
