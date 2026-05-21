import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";
import { has } from "../helpers";

type TankMixProduct = {
  productName?: string;
  epaRegistrationNumber?: string;
  applicationRate?: string;
  totalAmount?: string;
};

type CI = ApplicationRecord["contractorInputs"] & {
  tankMixProducts?: TankMixProduct[];
};

const hasTankMix = (record: ApplicationRecord) => {
  const arr = (record.contractorInputs as CI).tankMixProducts;
  return Array.isArray(arr) && arr.length > 0;
};

export const tankMixRules: ComplianceRule[] = [
  // Matrix #65: every product in the tank mix is listed individually.
  {
    ruleId: "TANK_MIX_PRODUCT_LIST_INCOMPLETE",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(I)(J)(K) — each product in a tank mix must be listed individually with its trade name, EPA registration number, and rate.",
    citationShort: "2 CSR 70-25.120(I)",
    description: "Tank mix products listed individually",
    message:
      "Tank mix product list is incomplete — at least one entry is missing a trade name.",
    appliesWhen: hasTankMix,
    evaluate: (record) => {
      const arr = (record.contractorInputs as CI).tankMixProducts ?? [];
      return {
        status: arr.every((p) => has(p.productName)) ? "pass" : "fail",
      };
    },
  },

  // Matrix #66: EPA registration number (or correlation evidence) for each product.
  {
    ruleId: "TANK_MIX_MISSING_EPA",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(J) — every product in a tank mix must carry an EPA registration number (or documented correlation evidence).",
    citationShort: "2 CSR 70-25.120(J)",
    description: "Tank mix products carry EPA registration numbers",
    message:
      "At least one tank-mix product is missing its EPA registration number.",
    appliesWhen: hasTankMix,
    evaluate: (record) => {
      const arr = (record.contractorInputs as CI).tankMixProducts ?? [];
      return {
        status: arr.every((p) => has(p.epaRegistrationNumber)) ? "pass" : "fail",
      };
    },
  },

  // Matrix #67: rate/amount for each product in the mix.
  {
    ruleId: "TANK_MIX_MISSING_RATE_OR_AMOUNT",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "2 CSR 70-25.120(K) — every product in a tank mix must record its rate or amount used.",
    citationShort: "2 CSR 70-25.120(K)",
    description: "Tank mix products carry rate / amount",
    message:
      "At least one tank-mix product is missing both its rate and total amount.",
    appliesWhen: hasTankMix,
    evaluate: (record) => {
      const arr = (record.contractorInputs as CI).tankMixProducts ?? [];
      return {
        status: arr.every((p) => has(p.applicationRate) || has(p.totalAmount))
          ? "pass"
          : "fail",
      };
    },
  },
];
