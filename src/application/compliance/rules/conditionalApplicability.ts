import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";
import { has, requiredFieldRule } from "../helpers";

type CI = ApplicationRecord["contractorInputs"] & {
  indoorSpotCrackCrevice?: boolean;
  slnNumber?: string;
  epaRegistrationCorrelationEvidenceId?: string;
  isPremixed?: boolean;
  premixedAmountUsed?: string;
  premixedActualRate?: string;
  structuralTermiteWithin10ft?: boolean;
};

export const conditionalApplicabilityRules: ComplianceRule[] = [
  // Matrix #26: indoor spot/crack-crevice exemption from the area-size
  // requirement. When neither flag has been set nor cleared the applicability of
  // matrix #24 (size of area treated) is unresolved → NEEDS_REVIEW.
  {
    ruleId: "INDOOR_EXEMPTION_NOT_CLASSIFIED",
    resultCode: "NEEDS_REVIEW",
    citation:
      "2 CSR 70-25.120(F) — indoor spot or crack-and-crevice applications are exempt from the area-size record requirement; classifying the application drives applicability.",
    citationShort: "2 CSR 70-25.120(F)",
    description: "Indoor spot/crack-crevice exemption classified",
    message:
      "Indoor spot/crack-crevice exemption is unclassified — classification drives whether the area-size requirement applies (matrix #26).",
    // Only fires for the indoor-structural cases where the exemption could
    // plausibly apply. Outdoor agricultural records don't need this answered.
    appliesWhen: (record) => {
      const t =
        (record.contractorInputs as { siteType?: string }).siteType
          ?.toLowerCase()
          .trim() ?? "";
      return /indoor|structural|structure|warehouse/.test(t);
    },
    evaluate: (record) => {
      const v = (record.contractorInputs as CI).indoorSpotCrackCrevice;
      return { status: typeof v === "boolean" ? "pass" : "fail" };
    },
  },

  // Matrix #33: when product/use involves a Special Local Need registration,
  // the SLN number must be recorded. Flag the absence as NEEDS_REVIEW so the
  // operator confirms whether SLN applies (we can't know without label data).
  {
    ruleId: "SLN_NUMBER_NOT_CONFIRMED",
    resultCode: "NEEDS_REVIEW",
    citation:
      "2 CSR 70-25.120(J) — Special Local Need (SLN) registration numbers must be recorded when applicable.",
    citationShort: "2 CSR 70-25.120(J)",
    description: "SLN registration number confirmed",
    message:
      "Special Local Need (SLN) registration applicability is not confirmed — record the SLN number if the product/use is SLN-registered (matrix #33).",
    evaluate: (record) => {
      const v = (record.contractorInputs as CI).slnNumber;
      // `pass` if either an SLN number is recorded, or the operator has
      // explicitly cleared the field (empty string vs. undefined). For now,
      // require an explicit value (empty string OK).
      return { status: v === undefined ? "fail" : "pass" };
    },
  },

  // Matrix #34: when an EPA registration is documented by correlation evidence
  // rather than a direct number, the evidence identifier must be recorded. The
  // MISSING_EPA_REG rule already accepts correlation evidence as a substitute,
  // so this rule is a stricter check: if the operator provided the evidence id
  // path, it must not be a blank placeholder.
  {
    ruleId: "EPA_CORRELATION_EVIDENCE_PARTIAL",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(J) — when EPA registration is documented by correlation evidence, the evidence identifier must be a real reference.",
    citationShort: "2 CSR 70-25.120(J)",
    description: "EPA-correlation evidence reference is non-blank",
    message:
      "EPA-correlation evidence identifier is whitespace — record a real reference or supply the EPA registration number.",
    appliesWhen: (record) => {
      const ci = record.contractorInputs as CI;
      return (
        !has(record.contractorInputs.epaRegistrationNumber) &&
        ci.epaRegistrationCorrelationEvidenceId !== undefined
      );
    },
    evaluate: (record) => ({
      status: has(
        (record.contractorInputs as CI).epaRegistrationCorrelationEvidenceId
      )
        ? "pass"
        : "fail",
    }),
  },

  // Matrix #41-#43: when the product is pre-mixed / ready-to-use, the amount
  // used and actual rate of application must be recorded.
  requiredFieldRule({
    ruleId: "MISSING_PREMIXED_AMOUNT",
    citationShort: "2 CSR 70-25.120(L)",
    citation:
      "2 CSR 70-25.120(L) — pre-mixed / ready-to-use products must record a reasonable estimate of the amount used.",
    description: "Premixed amount used recorded",
    message:
      "Product is marked pre-mixed / ready-to-use but the amount used is missing.",
    appliesWhen: (record) => (record.contractorInputs as CI).isPremixed === true,
    isPresent: (r) => has((r.contractorInputs as CI).premixedAmountUsed),
  }),
  requiredFieldRule({
    ruleId: "MISSING_PREMIXED_ACTUAL_RATE",
    citationShort: "2 CSR 70-25.120(L)",
    citation:
      "2 CSR 70-25.120(L) — pre-mixed / ready-to-use products must record the actual rate of application.",
    description: "Premixed actual application rate recorded",
    message:
      "Product is marked pre-mixed / ready-to-use but the actual application rate is missing.",
    appliesWhen: (record) => (record.contractorInputs as CI).isPremixed === true,
    isPresent: (r) => has((r.contractorInputs as CI).premixedActualRate),
  }),

  // Matrix #45: structural / termite-within-10ft exception from outdoor weather.
  // When the operator has not classified the exception for a structural site, the
  // applicability of matrix #46-#48 (weather requirements) is unresolved.
  {
    ruleId: "STRUCTURAL_TERMITE_EXCEPTION_NOT_CLASSIFIED",
    resultCode: "NEEDS_REVIEW",
    citation:
      "2 CSR 70-25.120(M) — general structural pest control or termite pest control within 10 ft of a building is exempt from the outdoor weather-record requirements; classifying the application drives applicability.",
    citationShort: "2 CSR 70-25.120(M)",
    description: "Structural / termite-within-10ft exception classified",
    message:
      "Structural / termite-within-10ft exception is unclassified — classification drives whether outdoor weather is required (matrix #45).",
    appliesWhen: (record) => {
      const t =
        (record.contractorInputs as { siteType?: string }).siteType
          ?.toLowerCase()
          .trim() ?? "";
      return /structural|structure|termite/.test(t);
    },
    evaluate: (record) => {
      const v = (record.contractorInputs as CI).structuralTermiteWithin10ft;
      return { status: typeof v === "boolean" ? "pass" : "fail" };
    },
  },
];
