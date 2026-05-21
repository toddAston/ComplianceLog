import { describe, it, expect } from "vitest";
import { runAllComplianceChecks, runComplianceChecks } from "./index";
import type { ApplicationRecord, ContractorInputs } from "../../domain/types";

type RecordOverrides = Partial<ContractorInputs> & {
  createdAt?: string;
  requesterName?: string;
  requesterAddress?: string;
  siteAddress?: string;
  siteDescription?: string;
};

function makeRecord(overrides: RecordOverrides = {}): ApplicationRecord {
  const { createdAt, ...rest } = overrides;
  const contractorInputs = {
    applicatorId: "app-1",
    applicatorName: "John",
    company: "SprayCo",
    certificationNumber: "MO-123",
    farmId: "farm-1",
    farmName: "North Farm",
    fieldId: "field-1",
    fieldName: "Field 7",
    cropOrSite: "Corn",
    acresTreated: "40",
    productId: "prod-1",
    productName: "Herbicide X",
    epaRegistrationNumber: "12345-678",
    rupStatus: "no" as const,
    catalogVersion: "v1",
    applicationDate: "2026-05-18",
    startTime: "08:00",
    endTime: "09:00",
    applicationMethod: "Ground broadcast",
    rateApplied: "1 qt/ac",
    totalAmountApplied: "10 gal",
    targetPest: "Western Corn Rootworm",
    temperature: "72F",
    windSpeed: "5 mph",
    windDirection: "SSW",
    attestationConfirmed: true,
    requesterName: "Acme Producer Co.",
    requesterAddress: "1234 Main St, Columbia, MO 65201",
    siteDescription: "North 40, soybean field along Highway B",
    ...rest,
  } as ContractorInputs;
  return {
    id: "rec-1",
    organizationId: "org-1",
    workflowStatus: "draft",
    syncStatus: "local_only",
    contractorInputs,
    managerInputs: { reviewStatus: "not_reviewed" },
    system: {
      createdAt: createdAt ?? "2026-05-18T10:00:00Z",
      createdOffline: true,
      lastUpdatedAt: "2026-05-18T10:00:00Z",
    },
    complianceReviewRequired: false,
  };
}

describe("compliance resultCode override for passing outcomes", () => {
  it("passing outcomes carry resultCode 'OK' regardless of the rule's declared resultCode", () => {
    const outcomes = runAllComplianceChecks(makeRecord());
    const passing = outcomes.filter((o) => o.status === "pass");
    expect(passing.length).toBeGreaterThan(0);
    for (const o of passing) {
      expect(o.resultCode, `${o.ruleId} should carry resultCode OK when passing`).toBe(
        "OK"
      );
    }
  });

  it("failing outcomes preserve their declared resultCode (MISSING_TARGET_PEST → MISSING_REQUIRED_FIELD)", () => {
    const outcomes = runAllComplianceChecks(makeRecord({ targetPest: "" }));
    const targetPest = outcomes.find((o) => o.ruleId === "MISSING_TARGET_PEST");
    expect(targetPest).toBeDefined();
    expect(targetPest!.status).toBe("fail");
    expect(targetPest!.resultCode).toBe("MISSING_REQUIRED_FIELD");
    expect(targetPest!.resultCode).not.toBe("OK");
  });

  it("unknown outcomes preserve their declared resultCode (RECORD_LATE unknown → WARNING)", () => {
    const outcomes = runAllComplianceChecks(makeRecord({ applicationDate: "" }));
    const recordLate = outcomes.find((o) => o.ruleId === "RECORD_LATE");
    expect(recordLate).toBeDefined();
    expect(recordLate!.status).toBe("unknown");
    expect(recordLate!.resultCode).toBe("WARNING");
    expect(recordLate!.resultCode).not.toBe("OK");
  });

  it("runComplianceChecks (failures-only) carries the failing resultCode", () => {
    const failures = runComplianceChecks(makeRecord({ targetPest: "" }));
    const targetPest = failures.find((f) => f.ruleId === "MISSING_TARGET_PEST");
    expect(targetPest).toBeDefined();
    expect(targetPest!.resultCode).toBe("MISSING_REQUIRED_FIELD");
    expect(targetPest!.resultCode).not.toBe("OK");
  });
});
