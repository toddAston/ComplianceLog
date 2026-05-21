import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";

type CI = ApplicationRecord["contractorInputs"] & {
  applicatorCategory?: string;
  supervisorIdentified?: boolean;
  workOrderAcknowledged?: boolean;
  labelInPossessionAcknowledged?: boolean;
  equipmentReadinessAcknowledged?: boolean;
};

const noncertifiedParticipation = (record: ApplicationRecord) => {
  const cat = (record.contractorInputs as CI).applicatorCategory ?? "";
  return /noncertified|trainee|technician/.test(cat);
};

// All four supervision/acknowledgment rules emit NEEDS_REVIEW (status `unknown`)
// when the acknowledgment is not yet recorded, so they show up in the audit
// checklist without blocking the lock gate. When the operator flags the
// acknowledgment, they `pass`.
const ackRule = (
  ruleId: string,
  description: string,
  message: string,
  citation: string,
  pick: (ci: CI) => boolean | undefined
): ComplianceRule => ({
  ruleId,
  resultCode: "NEEDS_REVIEW",
  citation,
  citationShort: "2 CSR 70-25.010",
  description,
  message,
  appliesWhen: noncertifiedParticipation,
  evaluate: (record) => {
    const v = pick(record.contractorInputs as CI);
    if (v === true) return { status: "pass" };
    return {
      status: "unknown",
      unknownReason: "Acknowledgment not yet recorded.",
    };
  },
});

export const supervisionRules: ComplianceRule[] = [
  // Matrix #68: a certified applicator must be supervising a noncertified application.
  ackRule(
    "SUPERVISOR_NOT_IDENTIFIED",
    "Supervising certified applicator identified",
    "A certified applicator must be supervising — record the supervisor's identity.",
    "RSMo 281.035 / 2 CSR 70-25.010 — noncertified applicator activity must be under the supervision of a certified applicator.",
    (ci) => ci.supervisorIdentified
  ),

  // Matrix #69: work order / job ticket with minimum details.
  ackRule(
    "WORK_ORDER_NOT_ACKNOWLEDGED",
    "Work order / job ticket evidence on file",
    "A noncertified applicator must have a work order / job ticket / invoice with the minimum required details.",
    "2 CSR 70-25.010 — noncertified applicators must operate from a work order with minimum required details.",
    (ci) => ci.workOrderAcknowledged
  ),

  // Matrix #70: label in possession + directions followed.
  ackRule(
    "LABEL_POSSESSION_NOT_ACKNOWLEDGED",
    "Label / labeling available on site",
    "A noncertified applicator must have the product label / labeling available and have followed its directions.",
    "2 CSR 70-25.010 — noncertified applicators must have the label available and follow its directions.",
    (ci) => ci.labelInPossessionAcknowledged
  ),

  // Matrix #71: equipment readiness.
  ackRule(
    "EQUIPMENT_READINESS_NOT_ACKNOWLEDGED",
    "Equipment checked and usable as intended",
    "Equipment must be checked and confirmed usable as intended for the application.",
    "2 CSR 70-25.010 — equipment must be confirmed usable as intended for the application.",
    (ci) => ci.equipmentReadinessAcknowledged
  ),
];
