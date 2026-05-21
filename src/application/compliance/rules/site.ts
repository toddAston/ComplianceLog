import type { ComplianceRule } from "../types";
import { has } from "../helpers";

// Matrix #21, #22: the application site is recorded as an address OR a brief
// description (2 CSR 70-25.120(E)). The rule passes if either is present.
// `MISSING_APPLICATION_SITE` already covers the farm/field structured identity,
// but the regulation requires a recognizable site address-or-description for the
// audit packet; this rule expresses that requirement directly.
export const siteRules: ComplianceRule[] = [
  {
    ruleId: "MISSING_SITE_ADDRESS_OR_DESCRIPTION",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(E) — Pesticide application records must include the address of the application site or a brief description of the site.",
    citationShort: "2 CSR 70-25.120(E)",
    description: "Application site address or description recorded",
    message:
      "Application site address or a brief site description is a required record field (either satisfies the requirement).",
    evaluate: (record) => {
      const ci = record.contractorInputs as {
        siteAddress?: string;
        siteDescription?: string;
      };
      return {
        status: has(ci.siteAddress) || has(ci.siteDescription) ? "pass" : "fail",
      };
    },
  },
];
