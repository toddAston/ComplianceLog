import type { ApplicationRecord } from "../../domain/types";

export type ComplianceSeverity = "warning" | "error" | "blocked";
export type ComplianceCheckStatus = "pass" | "fail" | "unknown";

// Matrix-faithful result codes from docs/build/compliance checks.md. `severity`
// (above) still drives UI coloring and submit/lock gating; `resultCode` carries
// the regulatory-matrix label so audit output can speak the matrix's vocabulary.
export type ComplianceResultCode =
  | "OK"
  | "MISSING_REQUIRED_FIELD"
  | "NEEDS_REVIEW"
  | "WARNING"
  | "LABEL_VERIFICATION_REQUIRED"
  | "SOURCE_UNAVAILABLE"
  | "BLOCKED_BY_EXPLICIT_RULE";

export type ComplianceCheckResult = {
  ruleId: string;
  severity: ComplianceSeverity;
  resultCode: ComplianceResultCode;
  message: string;
  citation: string;
  citationShort: string;
};

export type ComplianceCheckOutcome = ComplianceCheckResult & {
  status: ComplianceCheckStatus;
  description: string;
  unknownReason?: string;
};

// A single compliance rule. `severity` is optional: when omitted it is derived
// from `resultCode` via DEFAULT_SEVERITY (see helpers). `appliesWhen` declares
// the matrix "applies when" condition; a rule that does not apply to a record is
// reported as `pass` (the requirement is not triggered), matching prior inline
// gating behavior and keeping the status union at pass|fail|unknown.
export type ComplianceRule = {
  ruleId: string;
  resultCode: ComplianceResultCode;
  severity?: ComplianceSeverity;
  citation: string;
  citationShort: string;
  description: string;
  message: string;
  appliesWhen?: (record: ApplicationRecord) => boolean;
  evaluate: (record: ApplicationRecord) => {
    status: ComplianceCheckStatus;
    unknownReason?: string;
  };
};
