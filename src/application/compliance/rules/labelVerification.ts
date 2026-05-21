import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";
import { has, isOutdoorApplication } from "../helpers";

type CI = ApplicationRecord["contractorInputs"] & {
  productLabelRef?: string;
  labelVersionOrDate?: string;
  labelConsistencyReviewed?: boolean;
  labelCropSiteReviewed?: boolean;
  labelTargetPestReviewed?: boolean;
  labelRateReviewed?: boolean;
  labelTimingMethodReviewed?: boolean;
  labelPpeReviewed?: boolean;
  labelReiPhiReviewed?: boolean;
  labelDriftBufferReviewed?: boolean;
};

// Helper for the "X reviewed against label" boolean checks. The matrix says
// label-related checks must NEVER auto-pass — they sit at `unknown` (carrying
// resultCode LABEL_VERIFICATION_REQUIRED) until the operator explicitly flags
// the review done, at which point they `pass`. `unknown` keeps them out of the
// failure list surfaced by `runComplianceChecks` (so they don't block the lock
// gate) while still appearing in the audit packet's `complianceChecklist`.
const labelReviewRule = (
  ruleId: string,
  description: string,
  message: string,
  pick: (ci: CI) => boolean | undefined,
  appliesWhen?: (record: ApplicationRecord) => boolean
): ComplianceRule => ({
  ruleId,
  resultCode: "LABEL_VERIFICATION_REQUIRED",
  citation:
    "FIFRA labeling — use must be consistent with the product label; FieldLog flags label-driven questions for human review and never auto-passes them.",
  citationShort: "FIFRA_LABELING",
  description,
  message,
  appliesWhen,
  evaluate: (record) => {
    const v = pick(record.contractorInputs as CI);
    if (v === true) return { status: "pass" };
    return {
      status: "unknown",
      unknownReason: "Label verification required — review and acknowledge.",
    };
  },
});

export const labelVerificationRules: ComplianceRule[] = [
  // Matrix #35: label is attached or linked to the record.
  {
    ruleId: "LABEL_NOT_ATTACHED",
    resultCode: "LABEL_VERIFICATION_REQUIRED",
    citation:
      "FIFRA labeling — every product use should reference a label source (file, URL, or product-catalog link) for audit and review.",
    citationShort: "FIFRA_LABELING",
    description: "Product label attached or linked",
    message:
      "No product-label reference is recorded — attach a label file, URL, or product-catalog reference.",
    evaluate: (record) => {
      const v = (record.contractorInputs as CI).productLabelRef;
      if (has(v)) return { status: "pass" };
      return {
        status: "unknown",
        unknownReason: "No label reference attached.",
      };
    },
  },

  // Matrix #36: the attached label carries a version or retrieval date.
  {
    ruleId: "LABEL_VERSION_OR_DATE_MISSING",
    resultCode: "LABEL_VERIFICATION_REQUIRED",
    citation:
      "FIFRA labeling — label versions change; the version or retrieval date of the reviewed label should be recorded for audit.",
    citationShort: "FIFRA_LABELING",
    description: "Label version or retrieval date recorded",
    message:
      "Label reference is present but no version / retrieval date is recorded.",
    appliesWhen: (record) => has((record.contractorInputs as CI).productLabelRef),
    evaluate: (record) => {
      const v = (record.contractorInputs as CI).labelVersionOrDate;
      if (has(v)) return { status: "pass" };
      return {
        status: "unknown",
        unknownReason: "Label version / date missing.",
      };
    },
  },

  // Matrix #56-#64: human review acknowledgments.
  labelReviewRule(
    "LABEL_CONSISTENCY_NOT_REVIEWED",
    "Use reviewed for consistency with the label",
    "Has someone reviewed that this use is consistent with the product label? Flag the review and proceed.",
    (ci) => ci.labelConsistencyReviewed
  ),
  labelReviewRule(
    "LABEL_CROP_SITE_NOT_REVIEWED",
    "Crop / site reviewed against label",
    "Has the crop / site / use pattern been reviewed against the product label? Required for agricultural applications.",
    (ci) => ci.labelCropSiteReviewed,
    (record) => has(record.contractorInputs.cropOrSite)
  ),
  labelReviewRule(
    "LABEL_TARGET_PEST_NOT_REVIEWED",
    "Target pest reviewed against label",
    "Has the target pest been reviewed for label support (supported or not prohibited)?",
    (ci) => ci.labelTargetPestReviewed,
    (record) => has(record.contractorInputs.targetPest)
  ),
  labelReviewRule(
    "LABEL_RATE_NOT_REVIEWED",
    "Application rate reviewed against label",
    "Has the application rate been reviewed against the product label?",
    (ci) => ci.labelRateReviewed,
    (record) => has(record.contractorInputs.rateApplied)
  ),
  labelReviewRule(
    "LABEL_TIMING_METHOD_NOT_REVIEWED",
    "Timing and method reviewed against label",
    "Have the timing and method (e.g. growth stage, application method) been reviewed against the product label?",
    (ci) => ci.labelTimingMethodReviewed
  ),
  labelReviewRule(
    "LABEL_PPE_NOT_REVIEWED",
    "Label-required PPE reviewed",
    "Has the label-required PPE been reviewed and acknowledged?",
    (ci) => ci.labelPpeReviewed
  ),
  labelReviewRule(
    "LABEL_REI_PHI_NOT_REVIEWED",
    "REI / PHI reviewed against label",
    "Has the restricted-entry interval / pre-harvest interval been reviewed for this crop/site?",
    (ci) => ci.labelReiPhiReviewed,
    (record) => has(record.contractorInputs.cropOrSite)
  ),
  labelReviewRule(
    "LABEL_DRIFT_BUFFER_NOT_REVIEWED",
    "Label drift / buffer / weather restrictions reviewed",
    "Have label-specific drift, buffer, wind, rain, and temperature restrictions been reviewed for this outdoor application?",
    (ci) => ci.labelDriftBufferReviewed,
    isOutdoorApplication
  ),
];
