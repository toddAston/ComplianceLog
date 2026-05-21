import type { ComplianceRule } from "../types";
import { has, requiredFieldRule } from "../helpers";

// Matrix #19, #20: the requesting person's name and address are required
// fields on a Missouri pesticide application record (2 CSR 70-25.120(D)).
export const requesterRules: ComplianceRule[] = [
  requiredFieldRule({
    ruleId: "MISSING_REQUESTER_NAME",
    citationShort: "2 CSR 70-25.120(D)",
    citation:
      "2 CSR 70-25.120(D) — Pesticide application records must include the name of the person requesting the pesticide use.",
    description: "Name of person requesting pesticide use recorded",
    message:
      "Name of the person requesting the pesticide use is a required record field.",
    isPresent: (r) =>
      has(
        (r.contractorInputs as { requesterName?: string }).requesterName
      ),
  }),
  requiredFieldRule({
    ruleId: "MISSING_REQUESTER_ADDRESS",
    citationShort: "2 CSR 70-25.120(D)",
    citation:
      "2 CSR 70-25.120(D) — Pesticide application records must include the address of the person requesting the pesticide use.",
    description: "Address of person requesting pesticide use recorded",
    message:
      "Address of the person requesting the pesticide use is a required record field.",
    isPresent: (r) =>
      has(
        (r.contractorInputs as { requesterAddress?: string }).requesterAddress
      ),
  }),
];
