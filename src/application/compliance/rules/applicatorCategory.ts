import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";
import { has, requiredFieldRule } from "../helpers";

type CI = ApplicationRecord["contractorInputs"] & {
  applicatorCategory?: string;
  noncertifiedApplicatorName?: string;
  noncertifiedApplicatorLicense?: string;
  technicianName?: string;
  technicianLicense?: string;
  traineeName?: string;
};

const cat = (record: ApplicationRecord) =>
  (record.contractorInputs as CI).applicatorCategory ?? "";

const isCommercial = (record: ApplicationRecord) =>
  /commercial/.test(cat(record));
const isNoncommercialOrPublic = (record: ApplicationRecord) =>
  /noncommercial|public_operator/.test(cat(record));
const isNoncertified = (record: ApplicationRecord) =>
  /noncertified/.test(cat(record));
const isNoncertifiedRup = (record: ApplicationRecord) =>
  cat(record) === "noncertified_rup";
const isTechnician = (record: ApplicationRecord) =>
  cat(record) === "technician";
const isTrainee = (record: ApplicationRecord) => cat(record) === "trainee";

export const applicatorCategoryRules: ComplianceRule[] = [
  // Matrix #1: every record must classify the applicator into a category.
  {
    ruleId: "APPLICATOR_CATEGORY_UNKNOWN",
    resultCode: "NEEDS_REVIEW",
    citation:
      "2 CSR 70-25.120 / RSMo 281.035 — every pesticide application record must classify the applicator (certified commercial, noncommercial, public, private, noncertified, RUP, technician, or trainee).",
    citationShort: "2 CSR 70-25.120",
    description: "Applicator category classified",
    message:
      "Applicator category is unknown — classification drives Missouri recordkeeping-duty checks (matrix #1).",
    evaluate: (record) => {
      const v = (record.contractorInputs as CI).applicatorCategory;
      if (!v || v === "unknown") return { status: "fail" };
      return { status: "pass" };
    },
  },

  // Matrix #2: a commercial applicator must identify the responsible recordkeeper.
  {
    ruleId: "COMMERCIAL_RECORD_DUTY",
    resultCode: "NEEDS_REVIEW",
    citation:
      "RSMo 281.035 / 2 CSR 70-25.120 — a certified commercial applicator or their employer must maintain pesticide application records.",
    citationShort: "RSMo 281.035",
    description: "Commercial recordkeeper identified",
    message:
      "Commercial application: identify the responsible recordkeeper (applicator or employer) so the duty under RSMo 281.035 is satisfied.",
    appliesWhen: isCommercial,
    evaluate: (record) => ({
      status:
        has(record.contractorInputs.applicatorName) &&
        has(record.contractorInputs.company)
          ? "pass"
          : "fail",
    }),
  },

  // Matrix #3: noncommercial / public RUP records must identify the operator.
  {
    ruleId: "NONCOMMERCIAL_PUBLIC_RUP_DUTY",
    resultCode: "NEEDS_REVIEW",
    citation:
      "2 CSR 70-25.120 — certified noncommercial applicators and public operators must keep records for restricted-use pesticide applications.",
    citationShort: "2 CSR 70-25.120",
    description: "Noncommercial / public operator recordkeeping duty for RUP",
    message:
      "Noncommercial / public operator + RUP: identify the responsible recordkeeper to satisfy 2 CSR 70-25.120.",
    appliesWhen: (record) =>
      isNoncommercialOrPublic(record) &&
      record.contractorInputs.rupStatus === "yes",
    evaluate: (record) => ({
      status: has(record.contractorInputs.applicatorName) ? "pass" : "fail",
    }),
  },

  // Matrix #4: when RUP status is unknown the use is a label-verification item.
  {
    ruleId: "PESTICIDE_TYPE_UNKNOWN",
    resultCode: "LABEL_VERIFICATION_REQUIRED",
    citation:
      "FIFRA labeling / 2 CSR 70-25.120 — pesticide type (RUP vs general-use vs minimum-risk) drives recordkeeping and applicator-cert requirements.",
    citationShort: "FIFRA_LABELING",
    description: "Pesticide RUP / general-use status known",
    message:
      "Product RUP status is unknown — label review is required to determine recordkeeping and certification requirements.",
    evaluate: (record) => {
      if (record.contractorInputs.rupStatus === "unknown") {
        return {
          status: "unknown",
          unknownReason: "Product RUP status is unknown — label review required.",
        };
      }
      return { status: "pass" };
    },
  },

  // Matrix #10: noncertified applicator name required when one participated.
  requiredFieldRule({
    ruleId: "MISSING_NONCERTIFIED_APPLICATOR_NAME",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — when a noncertified applicator participated, their name must be recorded.",
    description: "Noncertified applicator name recorded",
    message: "Noncertified applicator participated but the name is missing.",
    appliesWhen: isNoncertified,
    isPresent: (r) => has((r.contractorInputs as CI).noncertifiedApplicatorName),
  }),

  // Matrix #11: noncertified RUP applicator name required when one participated.
  requiredFieldRule({
    ruleId: "MISSING_NONCERTIFIED_RUP_APPLICATOR_NAME",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — when a noncertified RUP applicator participated, their name must be recorded.",
    description: "Noncertified RUP applicator name recorded",
    message:
      "Noncertified RUP applicator participated but the name is missing.",
    appliesWhen: isNoncertifiedRup,
    isPresent: (r) => has((r.contractorInputs as CI).noncertifiedApplicatorName),
  }),

  // Matrix #12: noncertified RUP applicator license required.
  requiredFieldRule({
    ruleId: "MISSING_NONCERTIFIED_RUP_APPLICATOR_LICENSE",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — a noncertified RUP applicator's license number must be recorded.",
    description: "Noncertified RUP applicator license recorded",
    message:
      "Noncertified RUP applicator participated but their license number is missing.",
    appliesWhen: isNoncertifiedRup,
    isPresent: (r) =>
      has((r.contractorInputs as CI).noncertifiedApplicatorLicense),
  }),

  // Matrix #13: trainee name required when a trainee participated.
  requiredFieldRule({
    ruleId: "MISSING_TRAINEE_NAME",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — when a pesticide technician trainee participated, their name must be recorded.",
    description: "Pesticide technician trainee name recorded",
    message:
      "Pesticide technician trainee participated but their name is missing.",
    appliesWhen: isTrainee,
    isPresent: (r) => has((r.contractorInputs as CI).traineeName),
  }),

  // Matrix #14: technician name required when a technician participated.
  requiredFieldRule({
    ruleId: "MISSING_TECHNICIAN_NAME",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — when a pesticide technician participated, their name must be recorded.",
    description: "Pesticide technician name recorded",
    message: "Pesticide technician participated but their name is missing.",
    appliesWhen: isTechnician,
    isPresent: (r) => has((r.contractorInputs as CI).technicianName),
  }),

  // Matrix #15: technician license required when a technician participated.
  requiredFieldRule({
    ruleId: "MISSING_TECHNICIAN_LICENSE",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — a pesticide technician's license number must be recorded when they participated.",
    description: "Pesticide technician license recorded",
    message:
      "Pesticide technician participated but their license number is missing.",
    appliesWhen: isTechnician,
    isPresent: (r) => has((r.contractorInputs as CI).technicianLicense),
  }),
];
