import type { ComplianceRule } from "../types";

export const productRules: ComplianceRule[] = [
  {
    ruleId: "RUP_UNCERTIFIED",
    resultCode: "BLOCKED_BY_EXPLICIT_RULE",
    citation:
      "RSMo 281.037(9) — Restricted-use pesticide application requires a certified applicator.",
    citationShort: "RSMo 281.037(9)",
    description: "RUP applications use a certified applicator",
    message:
      "Restricted-use product applied by uncertified applicator — blocked by RSMo 281.037(9).",
    evaluate: (record) => {
      const { rupStatus, certificationNumber } = record.contractorInputs;
      const hasCert = !!certificationNumber?.trim();
      if (rupStatus === "yes") {
        return { status: hasCert ? "pass" : "fail" };
      }
      if (rupStatus === "unknown") {
        return {
          status: "unknown",
          unknownReason:
            "Product RUP status is unknown — cannot evaluate certification requirement.",
        };
      }
      return { status: "pass" };
    },
  },
];
