import type { ApplicationRecord } from "../../domain/types";
import type {
  ComplianceCheckOutcome,
  ComplianceCheckResult,
  ComplianceRule,
} from "./types";
import { severityOf } from "./helpers";
import { weatherRules } from "./rules/weather";
import { requiredFieldRules } from "./rules/requiredFields";
import { timingRetentionRules } from "./rules/timingRetention";
import { productRules } from "./rules/product";
import { requesterRules } from "./rules/requester";
import { siteRules } from "./rules/site";
import { structuredMeasurementRules } from "./rules/structuredMeasurements";
import { lesserThanLabelRules } from "./rules/lesserThanLabel";
import { chainOfCustodyRules } from "./rules/chainOfCustody";
import { applicatorCategoryRules } from "./rules/applicatorCategory";
import { conditionalApplicabilityRules } from "./rules/conditionalApplicability";
import { labelVerificationRules } from "./rules/labelVerification";
import { tankMixRules } from "./rules/tankMix";
import { supervisionRules } from "./rules/supervision";
import { directSupervisionRules } from "./rules/directSupervision";
import { evidenceQualityRules } from "./rules/evidenceQuality";

export const rules: ComplianceRule[] = [
  // P0
  ...weatherRules,
  ...requiredFieldRules,
  ...timingRetentionRules,
  ...productRules,
  ...requesterRules,
  ...siteRules,
  ...structuredMeasurementRules,
  ...lesserThanLabelRules,
  ...chainOfCustodyRules,
  // P1
  ...applicatorCategoryRules,
  ...conditionalApplicabilityRules,
  ...labelVerificationRules,
  // P2
  ...tankMixRules,
  ...supervisionRules,
  ...directSupervisionRules,
  ...evidenceQualityRules,
];

export function runAllComplianceChecks(
  record: ApplicationRecord
): ComplianceCheckOutcome[] {
  return rules.map((rule) => {
    // A rule whose `appliesWhen` is false is not triggered for this record and
    // is reported as `pass` (the requirement does not apply).
    const applies = rule.appliesWhen ? rule.appliesWhen(record) : true;
    const { status, unknownReason } = applies
      ? rule.evaluate(record)
      : { status: "pass" as const, unknownReason: undefined };
    return {
      ruleId: rule.ruleId,
      severity: severityOf(rule),
      resultCode: status === "pass" ? "OK" : rule.resultCode,
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
    .map(({ ruleId, severity, resultCode, message, citation, citationShort }) => ({
      ruleId,
      severity,
      resultCode,
      message,
      citation,
      citationShort,
    }));
}
