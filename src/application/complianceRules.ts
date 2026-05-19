import type { ApplicationRecord } from "../domain/types";

export type ComplianceSeverity = "warning" | "error" | "blocked";

export type ComplianceCheckResult = {
  ruleId: string;
  severity: ComplianceSeverity;
  message: string;
  citation: string;
  citationShort: string;
};

type ComplianceRule = {
  ruleId: string;
  severity: ComplianceSeverity;
  citation: string;
  citationShort: string;
  message: string;
  check: (record: ApplicationRecord) => boolean;
};

const rules: ComplianceRule[] = [
  {
    ruleId: "MISSING_WIND",
    severity: "warning",
    citation:
      "2 CSR 70-25.120(M) — Wind speed and direction required for outdoor pesticide application records.",
    citationShort: "2 CSR 70-25.120(M)",
    message:
      "Missing wind speed or direction — required by 2 CSR 70-25.120(M).",
    check: (record) => {
      const { windSpeed, windDirection } = record.contractorInputs;
      return !windSpeed?.trim() || !windDirection?.trim();
    },
  },
  {
    ruleId: "MISSING_TARGET_PEST",
    severity: "error",
    citation:
      "2 CSR 70-25.120(H) — Target pest(s) must be recorded for each pesticide application.",
    citationShort: "2 CSR 70-25.120(H)",
    message: "Missing target pest — required by 2 CSR 70-25.120(H).",
    check: (record) => {
      return !record.contractorInputs.targetPest?.trim();
    },
  },
  {
    ruleId: "RECORD_LATE",
    severity: "warning",
    citation:
      "2 CSR 70-25.120(1) — Records must be completed within 3 business days of the pesticide use date.",
    citationShort: "2 CSR 70-25.120(1)",
    message:
      "Record completed more than 3 days after application — required by 2 CSR 70-25.120(1).",
    check: (record) => {
      const appDate = record.contractorInputs.applicationDate;
      const createdAt = record.system.createdAt;
      if (!appDate || !createdAt) return false;
      const app = new Date(appDate);
      const created = new Date(createdAt);
      if (isNaN(app.getTime()) || isNaN(created.getTime())) return false;
      const diffMs = created.getTime() - app.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays > 3;
    },
  },
  {
    ruleId: "RUP_UNCERTIFIED",
    severity: "blocked",
    citation:
      "RSMo 281.037(9) — Restricted-use pesticide application requires a certified applicator.",
    citationShort: "RSMo 281.037(9)",
    message:
      "Restricted-use product applied by uncertified applicator — blocked by RSMo 281.037(9).",
    check: (record) => {
      return (
        record.contractorInputs.rupStatus === "yes" &&
        !record.contractorInputs.certificationNumber?.trim()
      );
    },
  },
];

export function runComplianceChecks(
  record: ApplicationRecord
): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];
  for (const rule of rules) {
    if (rule.check(record)) {
      results.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        message: rule.message,
        citation: rule.citation,
        citationShort: rule.citationShort,
      });
    }
  }
  return results;
}
