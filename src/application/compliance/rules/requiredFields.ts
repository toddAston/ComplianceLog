import type { ComplianceRule } from "../types";
import { has, requiredFieldRule } from "../helpers";

export const requiredFieldRules: ComplianceRule[] = [
  {
    ruleId: "MISSING_TARGET_PEST",
    resultCode: "MISSING_REQUIRED_FIELD",
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
  requiredFieldRule({
    ruleId: "MISSING_APPLICATOR",
    citationShort: "2 CSR 70-25.120(A)",
    citation:
      "2 CSR 70-25.120(A) — Pesticide application records must identify the applicator.",
    description: "Applicator identity recorded",
    message:
      "The applicator's name is a required record field for Missouri pesticide application records.",
    isPresent: (r) => has(r.contractorInputs.applicatorName),
  }),
  requiredFieldRule({
    ruleId: "MISSING_APPLICATION_DATE",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — Pesticide application records must include the date of application.",
    description: "Application date recorded",
    message:
      "Application date is a required record field for Missouri pesticide application records.",
    isPresent: (r) => has(r.contractorInputs.applicationDate),
  }),
  requiredFieldRule({
    ruleId: "MISSING_START_TIME",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — Pesticide application records must include the start time of application.",
    description: "Start time recorded",
    message:
      "Start time is a required record field for Missouri pesticide application records.",
    isPresent: (r) => has(r.contractorInputs.startTime),
  }),
  requiredFieldRule({
    ruleId: "MISSING_END_TIME",
    citationShort: "2 CSR 70-25.120(B)",
    citation:
      "2 CSR 70-25.120(B) — Pesticide application records must include the end time of application.",
    description: "End time recorded",
    message:
      "End time is a required record field for Missouri pesticide application records.",
    isPresent: (r) => has(r.contractorInputs.endTime),
  }),
  requiredFieldRule({
    ruleId: "MISSING_APPLICATION_SITE",
    citationShort: "2 CSR 70-25.120(C)",
    citation:
      "2 CSR 70-25.120(C) — Pesticide application records must identify the application site (farm and field).",
    description: "Application site recorded",
    message:
      "The application site (farm and field) is a required record field for Missouri pesticide application records.",
    isPresent: (r) =>
      has(r.contractorInputs.farmName) && has(r.contractorInputs.fieldName),
  }),
  requiredFieldRule({
    ruleId: "MISSING_AREA_TREATED",
    citationShort: "2 CSR 70-25.120(D)",
    citation:
      "2 CSR 70-25.120(D) — Pesticide application records must include the size of the area treated.",
    description: "Area treated recorded",
    message:
      "Area treated (acres) is a required record field for Missouri pesticide application records.",
    isPresent: (r) => has(r.contractorInputs.acresTreated),
  }),
  requiredFieldRule({
    ruleId: "MISSING_CROP_OR_SITE",
    citationShort: "2 CSR 70-25.120(E)",
    citation:
      "2 CSR 70-25.120(E) — Pesticide application records must include the crop, commodity, or site treated.",
    description: "Crop, commodity, or site recorded",
    message:
      "Crop, commodity, or site treated is a required record field for Missouri pesticide application records.",
    isPresent: (r) => has(r.contractorInputs.cropOrSite),
  }),
  requiredFieldRule({
    ruleId: "MISSING_PRODUCT_NAME",
    citationShort: "2 CSR 70-25.120(F)",
    citation:
      "2 CSR 70-25.120(F) — Pesticide application records must include the product trade name.",
    description: "Product trade name recorded",
    message:
      "Product trade name is a required record field for Missouri pesticide application records.",
    isPresent: (r) => has(r.contractorInputs.productName),
  }),
  {
    ruleId: "MISSING_EPA_REG",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(F) — Pesticide application records must include the EPA registration number of the product applied (or documented correlation evidence).",
    citationShort: "2 CSR 70-25.120(F)",
    description: "EPA registration number recorded",
    message:
      "This record is missing the EPA registration number or documented correlation evidence.",
    evaluate: (record) => {
      const ci = record.contractorInputs as {
        epaRegistrationNumber?: string;
        epaRegistrationCorrelationEvidenceId?: string;
      };
      const present =
        has(ci.epaRegistrationNumber) ||
        has(ci.epaRegistrationCorrelationEvidenceId);
      return { status: present ? "pass" : "fail" };
    },
  },
  {
    ruleId: "MISSING_RATE_OR_AMOUNT",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(G) — Pesticide application records must include the rate of application and the total amount of product applied.",
    citationShort: "2 CSR 70-25.120(G)",
    description: "Application rate and total amount recorded",
    message:
      "Application rate and total amount applied are required record fields for Missouri pesticide application records.",
    evaluate: (record) => {
      const { rateApplied, totalAmountApplied } = record.contractorInputs;
      return {
        status: has(rateApplied) && has(totalAmountApplied) ? "pass" : "fail",
      };
    },
  },
];
