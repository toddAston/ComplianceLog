import type { ComplianceRule } from "../types";
import { has, isOutdoorApplication } from "../helpers";

// Outdoor weather is tagged MISSING_REQUIRED_FIELD by the matrix (2 CSR
// 70-25.120(M), items 46-48) but surfaced as an advisory `warning` here so it
// does not hard-block manager approval. `appliesWhen` gates these to outdoor
// applications; indoor/structural sites do not require weather data.
export const weatherRules: ComplianceRule[] = [
  {
    ruleId: "MISSING_WIND",
    resultCode: "MISSING_REQUIRED_FIELD",
    severity: "warning",
    citation:
      "2 CSR 70-25.120(M) — Outdoor pesticide application records must include measured wind speed and wind direction at the application site.",
    citationShort: "2 CSR 70-25.120(M)",
    description: "Wind speed and direction recorded",
    message:
      "Outdoor pesticide application records must include measured wind speed and wind direction at the application site.",
    appliesWhen: isOutdoorApplication,
    evaluate: (record) => {
      const { windSpeed, windDirection } = record.contractorInputs;
      const missing = !windSpeed?.trim() || !windDirection?.trim();
      return { status: missing ? "fail" : "pass" };
    },
  },
  {
    ruleId: "MISSING_AIR_TEMPERATURE",
    resultCode: "MISSING_REQUIRED_FIELD",
    severity: "warning",
    citation:
      "2 CSR 70-25.120(M) — Outdoor pesticide application records must include the air temperature at the application site.",
    citationShort: "2 CSR 70-25.120(M)",
    description: "Air temperature recorded",
    message:
      "Outdoor pesticide application records must include the air temperature at the application site.",
    appliesWhen: isOutdoorApplication,
    evaluate: (record) => ({
      status: has(record.contractorInputs.temperature) ? "pass" : "fail",
    }),
  },
];
