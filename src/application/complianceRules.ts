// Public entry point for the compliance engine. The rules now live in
// `./compliance/` (domain-organized modules); this module re-exports the stable
// surface so existing import sites (UI, services, sync, server) are unaffected.
export type {
  ComplianceSeverity,
  ComplianceCheckStatus,
  ComplianceResultCode,
  ComplianceCheckResult,
  ComplianceCheckOutcome,
  ComplianceRule,
} from "./compliance/types";

export {
  computeRetainUntil,
  isOutdoorApplication,
} from "./compliance/helpers";

export {
  rules,
  runAllComplianceChecks,
  runComplianceChecks,
} from "./compliance/index";
