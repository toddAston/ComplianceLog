import type { ApplicationRecord } from "../domain/types";

export type ComplianceSeverity = "warning" | "error" | "blocked";
export type ComplianceCheckStatus = "pass" | "fail" | "unknown";

export type ComplianceCheckResult = {
  ruleId: string;
  severity: ComplianceSeverity;
  message: string;
  citation: string;
  citationShort: string;
};

export type ComplianceCheckOutcome = ComplianceCheckResult & {
  status: ComplianceCheckStatus;
  description: string;
  unknownReason?: string;
};

type ComplianceRule = {
  ruleId: string;
  severity: ComplianceSeverity;
  citation: string;
  citationShort: string;
  description: string;
  message: string;
  evaluate: (record: ApplicationRecord) => {
    status: ComplianceCheckStatus;
    unknownReason?: string;
  };
};

const rules: ComplianceRule[] = [
  {
    ruleId: "MISSING_WIND",
    severity: "warning",
    citation:
      "2 CSR 70-25.120(M) — Wind speed and direction required for outdoor pesticide application records.",
    citationShort: "2 CSR 70-25.120(M)",
    description: "Wind speed and direction recorded",
    message:
      "Missing wind speed or direction — required by 2 CSR 70-25.120(M).",
    evaluate: (record) => {
      const { windSpeed, windDirection } = record.contractorInputs;
      const missing = !windSpeed?.trim() || !windDirection?.trim();
      return { status: missing ? "fail" : "pass" };
    },
  },
  {
    ruleId: "MISSING_TARGET_PEST",
    severity: "error",
    citation:
      "2 CSR 70-25.120(H) — Target pest(s) must be recorded for each pesticide application.",
    citationShort: "2 CSR 70-25.120(H)",
    description: "Target pest recorded",
    message: "Missing target pest — required by 2 CSR 70-25.120(H).",
    evaluate: (record) => {
      const missing = !record.contractorInputs.targetPest?.trim();
      return { status: missing ? "fail" : "pass" };
    },
  },
  {
    ruleId: "RECORD_LATE",
    severity: "warning",
    citation:
      "2 CSR 70-25.120(1) — Records must be completed within 3 business days of the pesticide use date.",
    citationShort: "2 CSR 70-25.120(1)",
    description: "Record completed within 3 days of application",
    message:
      "Record completed more than 3 days after application — required by 2 CSR 70-25.120(1).",
    evaluate: (record) => {
      const appDate = record.contractorInputs.applicationDate;
      const createdAt = record.system.createdAt;
      if (!appDate || !createdAt) {
        return {
          status: "unknown",
          unknownReason: "Application date or creation timestamp missing.",
        };
      }
      const app = new Date(appDate);
      const created = new Date(createdAt);
      if (isNaN(app.getTime()) || isNaN(created.getTime())) {
        return {
          status: "unknown",
          unknownReason: "Could not parse application date or creation timestamp.",
        };
      }
      const diffDays =
        (created.getTime() - app.getTime()) / (1000 * 60 * 60 * 24);
      return { status: diffDays > 3 ? "fail" : "pass" };
    },
  },
  {
    ruleId: "RUP_UNCERTIFIED",
    severity: "blocked",
    citation:
      "RSMo 281.037(9) — Restricted-use pesticide application requires a certified applicator.",
    citationShort: "RSMo 281.037(9)",
    description: "RUP applications use a certified applicator",
    message:
      "Restricted-use product applied by uncertified applicator — blocked by RSMo 281.037(9).",
    evaluate: (record) => {
      const { rupStatus, certificationNumber } = record.contractorInputs;
      const hasCert = !!certificationNumber?.trim();
      if (rupStatus === "yes") {
        return { status: hasCert ? "pass" : "fail" };
      }
      if (rupStatus === "unknown") {
        return {
          status: "unknown",
          unknownReason:
            "Product RUP status is unknown — cannot evaluate certification requirement.",
        };
      }
      return { status: "pass" };
    },
  },
];

export function runAllComplianceChecks(
  record: ApplicationRecord
): ComplianceCheckOutcome[] {
  return rules.map((rule) => {
    const { status, unknownReason } = rule.evaluate(record);
    return {
      ruleId: rule.ruleId,
      severity: rule.severity,
      status,
      description: rule.description,
      message: rule.message,
      citation: rule.citation,
      citationShort: rule.citationShort,
      unknownReason,
    };
  });
}

export function runComplianceChecks(
  record: ApplicationRecord
): ComplianceCheckResult[] {
  return runAllComplianceChecks(record)
    .filter((o) => o.status === "fail")
    .map(
      ({ ruleId, severity, message, citation, citationShort }) => ({
        ruleId,
        severity,
        message,
        citation,
        citationShort,
      })
    );
}
