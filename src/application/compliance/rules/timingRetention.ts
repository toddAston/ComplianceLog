import type { ComplianceRule } from "../types";
import { businessDaysBetween, computeRetainUntil } from "../helpers";

export const timingRetentionRules: ComplianceRule[] = [
  {
    ruleId: "RECORD_LATE",
    resultCode: "WARNING",
    citation:
      "2 CSR 70-25.120 — Pesticide application records must be completed within three business days of the pesticide use date.",
    citationShort: "2 CSR 70-25.120(1)",
    description: "Record completed within three business days of application",
    message:
      "This record appears to have been completed more than three business days after the pesticide use date.",
    evaluate: (record) => {
      const appDate = record.contractorInputs.applicationDate;
      const completedAt =
        record.contractorInputs.submittedAt ?? record.system.createdAt;
      if (!appDate || !completedAt) {
        return {
          status: "unknown",
          unknownReason: "Application date or completion timestamp missing.",
        };
      }
      const app = new Date(appDate);
      const completed = new Date(completedAt);
      if (isNaN(app.getTime()) || isNaN(completed.getTime())) {
        return {
          status: "unknown",
          unknownReason:
            "Could not parse application date or completion timestamp.",
        };
      }
      return {
        status: businessDaysBetween(app, completed) > 3 ? "fail" : "pass",
      };
    },
  },
  {
    ruleId: "RETENTION_PERIOD",
    resultCode: "WARNING",
    citation:
      "RSMo 281.035 — Certified commercial applicators (or their employers) must maintain pesticide application records and retain them for three years; 2 CSR 70-25.120 specifies the required record contents.",
    citationShort: "RSMo 281.035",
    description: "Three-year record retention period",
    message:
      "Application date is required to derive the three-year record retention period (retain until application date plus three years).",
    evaluate: (record) => {
      const retainUntil = computeRetainUntil(
        record.contractorInputs.applicationDate
      );
      if (!retainUntil) {
        return {
          status: "unknown",
          unknownReason:
            "Application date missing or unparseable — cannot derive the retain-until date.",
        };
      }
      return { status: "pass" };
    },
  },
];
