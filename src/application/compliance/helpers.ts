import type { ApplicationRecord } from "../../domain/types";
import type {
  ComplianceResultCode,
  ComplianceRule,
  ComplianceSeverity,
} from "./types";

// Default severity per result code. A rule may override `severity` explicitly
// (e.g. outdoor weather is tagged MISSING_REQUIRED_FIELD by the matrix but the
// app surfaces it as an advisory `warning` rather than a hard approval blocker).
export const DEFAULT_SEVERITY: Record<ComplianceResultCode, ComplianceSeverity> =
  {
    OK: "warning",
    MISSING_REQUIRED_FIELD: "error",
    NEEDS_REVIEW: "warning",
    WARNING: "warning",
    LABEL_VERIFICATION_REQUIRED: "warning",
    SOURCE_UNAVAILABLE: "error",
    BLOCKED_BY_EXPLICIT_RULE: "blocked",
  };

export function severityOf(rule: ComplianceRule): ComplianceSeverity {
  return rule.severity ?? DEFAULT_SEVERITY[rule.resultCode];
}

export const has = (v: string | undefined | null): boolean => !!v?.trim();

// An application is treated as outdoor unless the record explicitly marks an
// enclosed site. The v0.1 form model has no indoor/outdoor toggle, so we read an
// optional `siteType` defensively; absent it, agricultural field applications are
// outdoor and the weather rules apply.
export function isOutdoorApplication(record: ApplicationRecord): boolean {
  const siteType =
    (record.contractorInputs as { siteType?: string }).siteType
      ?.toLowerCase()
      .trim() ?? "";
  return !/indoor|greenhouse|structural|structure|warehouse/.test(siteType);
}

// retainUntil = applicationDate + 3 years, as an ISO date (YYYY-MM-DD). Returns
// null when the application date is missing or unparseable.
export function computeRetainUntil(applicationDate: string): string | null {
  if (!applicationDate?.trim()) return null;
  const d = new Date(applicationDate);
  if (isNaN(d.getTime())) return null;
  const retain = new Date(d);
  retain.setUTCFullYear(retain.getUTCFullYear() + 3);
  return retain.toISOString().slice(0, 10);
}

// Business days strictly after `start` up to and including `end` (weekends only;
// public holidays are not modeled in v0.1).
export function businessDaysBetween(start: Date, end: Date): number {
  if (end.getTime() <= start.getTime()) return 0;
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  let count = 0;
  while (cur.getTime() < last.getTime()) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

// Factory for the common "a required record field must be present" check. Keeps
// the many 2 CSR 70-25.120 field rules consistent with the shared rule shape.
export function requiredFieldRule(spec: {
  ruleId: string;
  citationShort: string;
  citation: string;
  description: string;
  message: string;
  isPresent: (record: ApplicationRecord) => boolean;
  appliesWhen?: (record: ApplicationRecord) => boolean;
}): ComplianceRule {
  return {
    ruleId: spec.ruleId,
    resultCode: "MISSING_REQUIRED_FIELD",
    citation: spec.citation,
    citationShort: spec.citationShort,
    description: spec.description,
    message: spec.message,
    appliesWhen: spec.appliesWhen,
    evaluate: (record) => ({
      status: spec.isPresent(record) ? "pass" : "fail",
    }),
  };
}
