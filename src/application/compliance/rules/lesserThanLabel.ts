import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";
import { has, requiredFieldRule } from "../helpers";

type CI = ApplicationRecord["contractorInputs"] & {
  lessThanLabelConcentration?: boolean;
  producerRequestText?: string;
  producerRequestSignature?: string;
  producerRequestDate?: string;
};

// All three sub-fields apply only when an agricultural producer has requested a
// lesser-than-label concentration (matrix #52 → gates #53-#55).
const appliesWhenLesserThanLabelChosen = (record: ApplicationRecord) =>
  (record.contractorInputs as CI).lessThanLabelConcentration === true;

// Matrix #52-#55: agricultural-producer request for less-than-label
// concentration must be recorded in writing, signed, and dated.
export const lesserThanLabelRules: ComplianceRule[] = [
  requiredFieldRule({
    ruleId: "MISSING_PRODUCER_REQUEST_TEXT",
    citationShort: "2 CSR 70-25.120(N)",
    citation:
      "2 CSR 70-25.120(N) — A lesser-than-label concentration must be applied only at the written request of the agricultural producer.",
    description: "Written producer request recorded",
    message:
      "Lesser-than-label concentration is indicated but the written producer request text is missing.",
    appliesWhen: appliesWhenLesserThanLabelChosen,
    isPresent: (r) => has((r.contractorInputs as CI).producerRequestText),
  }),
  requiredFieldRule({
    ruleId: "MISSING_PRODUCER_REQUEST_SIGNATURE",
    citationShort: "2 CSR 70-25.120(N)",
    citation:
      "2 CSR 70-25.120(N) — The producer's request for a lesser-than-label concentration must be signed.",
    description: "Producer request signature recorded",
    message:
      "Lesser-than-label concentration is indicated but the producer's signature is missing.",
    appliesWhen: appliesWhenLesserThanLabelChosen,
    isPresent: (r) => has((r.contractorInputs as CI).producerRequestSignature),
  }),
  requiredFieldRule({
    ruleId: "MISSING_PRODUCER_REQUEST_DATE",
    citationShort: "2 CSR 70-25.120(N)",
    citation:
      "2 CSR 70-25.120(N) — The producer's request for a lesser-than-label concentration must be dated.",
    description: "Producer request date recorded",
    message:
      "Lesser-than-label concentration is indicated but the date of the producer's request is missing.",
    appliesWhen: appliesWhenLesserThanLabelChosen,
    isPresent: (r) => has((r.contractorInputs as CI).producerRequestDate),
  }),
];
