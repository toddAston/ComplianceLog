import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";
import { has } from "../helpers";

// Matrix #73, #74: a submitted record carries the submitter's identity and the
// submission timestamp. These are chain-of-custody fields owned by the service
// layer; the rules only fire once the record is past `draft` so live editing
// of a draft does not flag them prematurely.
const isSubmittedOrLater = (record: ApplicationRecord) =>
  record.workflowStatus !== "draft";

export const chainOfCustodyRules: ComplianceRule[] = [
  {
    ruleId: "MISSING_SUBMITTER_IDENTITY",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "FieldLog chain-of-custody — every submission must carry the identity of the submitter so the audit trail can attribute the record to a real actor.",
    citationShort: "FIELDLOG_CHAIN_OF_CUSTODY",
    description: "Submitter identity recorded on submission",
    message:
      "Submitter identity is missing from this submitted record (chain-of-custody integrity).",
    appliesWhen: isSubmittedOrLater,
    evaluate: (record) => ({
      status: has(record.contractorInputs.submittedBy) ? "pass" : "fail",
    }),
  },
  {
    ruleId: "MISSING_SUBMISSION_TIMESTAMP",
    resultCode: "MISSING_REQUIRED_FIELD",
    citation:
      "FieldLog chain-of-custody — every submission must carry the timestamp at which the contractor submitted the record.",
    citationShort: "FIELDLOG_CHAIN_OF_CUSTODY",
    description: "Submission timestamp recorded on submission",
    message:
      "Submission timestamp is missing from this submitted record (chain-of-custody integrity).",
    appliesWhen: isSubmittedOrLater,
    evaluate: (record) => ({
      status: has(record.contractorInputs.submittedAt) ? "pass" : "fail",
    }),
  },
];
