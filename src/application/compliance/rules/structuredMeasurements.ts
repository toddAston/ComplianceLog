import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";
import { has } from "../helpers";

type CI = ApplicationRecord["contractorInputs"] & {
  areaTreatedValue?: string;
  areaUnit?: string;
  applicationRateValue?: string;
  rateUnit?: string;
  mixtureRate?: string;
  totalMixtureAmount?: string;
};

// Matrix #25, #40: when the operator has opted into structured measurements
// (either area or rate), both the numeric value AND the unit must be present.
// These rules complement the legacy free-text `MISSING_AREA_TREATED` /
// `MISSING_RATE_OR_AMOUNT` checks rather than replacing them — they only fire
// when the operator started filling in the structured pair.
export const structuredMeasurementRules: ComplianceRule[] = [
  {
    ruleId: "MISSING_AREA_UNIT",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(F) — Size of area treated must include the unit of measure (acres, square feet, linear feet, etc.).",
    citationShort: "2 CSR 70-25.120(F)",
    description: "Area unit recorded alongside structured area value",
    message:
      "Structured area-treated value is recorded but the unit (acres, sq ft, linear ft, …) is missing.",
    appliesWhen: (record) => has((record.contractorInputs as CI).areaTreatedValue),
    evaluate: (record) => ({
      status: has((record.contractorInputs as CI).areaUnit) ? "pass" : "fail",
    }),
  },
  {
    ruleId: "MISSING_RATE_UNIT",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(K) — Rate of application must be recorded in reasonable, understandable units (oz/ac, lb/ac, gal/ac, etc.).",
    citationShort: "2 CSR 70-25.120(K)",
    description: "Rate unit recorded alongside structured rate value",
    message:
      "Structured application-rate value is recorded but the unit (oz/ac, lb/ac, gal/ac, …) is missing.",
    appliesWhen: (record) =>
      has((record.contractorInputs as CI).applicationRateValue),
    evaluate: (record) => ({
      status: has((record.contractorInputs as CI).rateUnit) ? "pass" : "fail",
    }),
  },
  {
    ruleId: "MISSING_TOTAL_MIXTURE_AMOUNT",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(K) — When a mixture rate is recorded, the total amount of mixture used must also be recorded.",
    citationShort: "2 CSR 70-25.120(K)",
    description: "Total amount of mixture recorded alongside mixture rate",
    message:
      "Mixture rate is recorded but the total amount of mixture used is missing.",
    appliesWhen: (record) => has((record.contractorInputs as CI).mixtureRate),
    evaluate: (record) => ({
      status: has((record.contractorInputs as CI).totalMixtureAmount)
        ? "pass"
        : "fail",
    }),
  },
];
