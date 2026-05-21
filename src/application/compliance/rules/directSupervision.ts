import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";

type CI = ApplicationRecord["contractorInputs"] & {
  applicatorCategory?: string;
  supervisorPhoneAvailable?: boolean;
  supervisorOnSiteIfLabelRequires?: boolean;
  workOrderMinimumContentVerified?: boolean;
};

const noncertifiedParticipation = (record: ApplicationRecord) => {
  const cat = (record.contractorInputs as CI).applicatorCategory ?? "";
  return /noncertified|trainee|technician/.test(cat);
};

// Mirrors the ackRule helper in supervision.ts but accepts a subsection-specific
// citationShort so each direct-supervision rule cites the exact paragraph of
// 2 CSR 70-25.010(3)(C) it derives from. Same NEEDS_REVIEW shape: `unknown`
// until acknowledged, `pass` once ticked, never `fail`.
const ackRule = (
  ruleId: string,
  description: string,
  message: string,
  citation: string,
  citationShort: string,
  pick: (ci: CI) => boolean | undefined
): ComplianceRule => ({
  ruleId,
  resultCode: "NEEDS_REVIEW",
  citation,
  citationShort,
  description,
  message,
  appliesWhen: noncertifiedParticipation,
  evaluate: (record) => {
    const v = pick(record.contractorInputs as CI);
    if (v === true) return { status: "pass" };
    return {
      status: "unknown",
      unknownReason: "Acknowledgment not yet recorded.",
    };
  },
});

export const directSupervisionRules: ComplianceRule[] = [
  // 2 CSR 70-25.010(3)(C)(7): certified supervisor must be available by phone
  // and respond in person when needed while the noncertified actor is using
  // pesticides.
  ackRule(
    "SUPERVISOR_PHONE_NOT_AVAILABLE",
    "Supervisor reachable by phone during the application",
    "The certified supervisor must be available by phone and respond in person when needed during noncertified application activity.",
    "2 CSR 70-25.010(3)(C)(7) — certified supervisor must be available by phone and respond in person when needed.",
    "2 CSR 70-25.010(3)(C)(7)",
    (ci) => ci.supervisorPhoneAvailable
  ),

  // 2 CSR 70-25.010(3)(C)(8): certified supervisor must be at the use site
  // when the pesticide label specifically requires it.
  ackRule(
    "SUPERVISOR_NOT_ON_SITE_WHEN_LABEL_REQUIRES",
    "Supervisor on site when the label requires",
    "The certified supervisor must be at the use site when the pesticide label requires on-site supervision.",
    "2 CSR 70-25.010(3)(C)(8) — certified supervisor must be at the use site when the pesticide label requires.",
    "2 CSR 70-25.010(3)(C)(8)",
    (ci) => ci.supervisorOnSiteIfLabelRequires
  ),

  // 2 CSR 70-25.010(3)(C)(3)(A-C): the work order in the noncertified actor's
  // possession must contain a minimum content set — certified applicator name +
  // license #, noncertified applicator name + license #, requester name + site
  // address-or-description + application date.
  ackRule(
    "WORK_ORDER_MINIMUM_CONTENT_NOT_VERIFIED",
    "Work order contains required minimum content",
    "The work order in the noncertified actor's possession must include the certified applicator's name + license #, the noncertified applicator's name + license #, and the requester's name + site address-or-description + application date.",
    "2 CSR 70-25.010(3)(C)(3)(A-C) — work order minimum content (applicator names + licenses, requester, site, date).",
    "2 CSR 70-25.010(3)(C)(3)",
    (ci) => ci.workOrderMinimumContentVerified
  ),
];
