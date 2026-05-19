import { describe, it, expect } from "vitest";
import { runComplianceChecks } from "./complianceRules";
import type { ApplicationRecord } from "../domain/types";

function makeRecord(
  overrides: Partial<{
    windSpeed: string;
    windDirection: string;
    targetPest: string;
    certificationNumber: string;
    rupStatus: "yes" | "no" | "unknown";
    applicationDate: string;
    createdAt: string;
  }> = {}
): ApplicationRecord {
  return {
    id: "rec-1",
    organizationId: "org-1",
    workflowStatus: "draft",
    syncStatus: "local_only",
    contractorInputs: {
      applicatorId: "app-1",
      applicatorName: "John",
      company: "SprayCo",
      certificationNumber: overrides.certificationNumber ?? "MO-123",
      farmId: "farm-1",
      farmName: "North Farm",
      fieldId: "field-1",
      fieldName: "Field 7",
      cropOrSite: "Corn",
      acresTreated: "40",
      productId: "prod-1",
      productName: "Herbicide X",
      epaRegistrationNumber: "12345-678",
      rupStatus: overrides.rupStatus ?? "no",
      catalogVersion: "v1",
      applicationDate: overrides.applicationDate ?? "2026-05-18",
      startTime: "08:00",
      endTime: "09:00",
      applicationMethod: "Ground broadcast",
      rateApplied: "1 qt/ac",
      totalAmountApplied: "10 gal",
      targetPest: overrides.targetPest ?? "Western Corn Rootworm",
      temperature: "72F",
      windSpeed: overrides.windSpeed ?? "5 mph",
      windDirection: overrides.windDirection ?? "SSW",
      attestationConfirmed: true,
    },
    managerInputs: { reviewStatus: "not_reviewed" },
    system: {
      createdAt: overrides.createdAt ?? "2026-05-18T10:00:00Z",
      createdOffline: true,
      lastUpdatedAt: "2026-05-18T10:00:00Z",
    },
    complianceReviewRequired: false,
  };
}

describe("complianceRules", () => {
  describe("MISSING_WIND", () => {
    it("passes when wind speed and direction are present", () => {
      const results = runComplianceChecks(makeRecord());
      expect(results.find((r) => r.ruleId === "MISSING_WIND")).toBeUndefined();
    });

    it("flags when wind speed is empty", () => {
      const results = runComplianceChecks(makeRecord({ windSpeed: "" }));
      const found = results.find((r) => r.ruleId === "MISSING_WIND");
      expect(found).toBeDefined();
      expect(found!.severity).toBe("warning");
      expect(found!.citationShort).toBe("2 CSR 70-25.120(M)");
    });

    it("flags when wind direction is empty", () => {
      const results = runComplianceChecks(makeRecord({ windDirection: "" }));
      expect(results.find((r) => r.ruleId === "MISSING_WIND")).toBeDefined();
    });
  });

  describe("MISSING_TARGET_PEST", () => {
    it("passes when target pest is present", () => {
      const results = runComplianceChecks(makeRecord());
      expect(
        results.find((r) => r.ruleId === "MISSING_TARGET_PEST")
      ).toBeUndefined();
    });

    it("flags when target pest is empty", () => {
      const results = runComplianceChecks(makeRecord({ targetPest: "" }));
      const found = results.find((r) => r.ruleId === "MISSING_TARGET_PEST");
      expect(found).toBeDefined();
      expect(found!.severity).toBe("error");
    });
  });

  describe("RECORD_LATE", () => {
    it("passes when record is created within 3 days", () => {
      const results = runComplianceChecks(
        makeRecord({
          applicationDate: "2026-05-15",
          createdAt: "2026-05-17T10:00:00Z",
        })
      );
      expect(
        results.find((r) => r.ruleId === "RECORD_LATE")
      ).toBeUndefined();
    });

    it("flags when record is created more than 3 days after application", () => {
      const results = runComplianceChecks(
        makeRecord({
          applicationDate: "2026-05-10",
          createdAt: "2026-05-18T10:00:00Z",
        })
      );
      const found = results.find((r) => r.ruleId === "RECORD_LATE");
      expect(found).toBeDefined();
      expect(found!.severity).toBe("warning");
    });
  });

  describe("RUP_UNCERTIFIED", () => {
    it("passes when product is not RUP", () => {
      const results = runComplianceChecks(
        makeRecord({ rupStatus: "no", certificationNumber: "" })
      );
      expect(
        results.find((r) => r.ruleId === "RUP_UNCERTIFIED")
      ).toBeUndefined();
    });

    it("passes when RUP and certified", () => {
      const results = runComplianceChecks(
        makeRecord({ rupStatus: "yes", certificationNumber: "MO-123" })
      );
      expect(
        results.find((r) => r.ruleId === "RUP_UNCERTIFIED")
      ).toBeUndefined();
    });

    it("flags when RUP and no certification number", () => {
      const results = runComplianceChecks(
        makeRecord({ rupStatus: "yes", certificationNumber: "" })
      );
      const found = results.find((r) => r.ruleId === "RUP_UNCERTIFIED");
      expect(found).toBeDefined();
      expect(found!.severity).toBe("blocked");
      expect(found!.citationShort).toBe("RSMo 281.037(9)");
    });
  });

  it("returns multiple violations at once", () => {
    const results = runComplianceChecks(
      makeRecord({ windSpeed: "", targetPest: "" })
    );
    expect(results.length).toBe(2);
    expect(results.map((r) => r.ruleId).sort()).toEqual([
      "MISSING_TARGET_PEST",
      "MISSING_WIND",
    ]);
  });

  it("returns empty array for a fully compliant record", () => {
    const results = runComplianceChecks(makeRecord());
    expect(results).toEqual([]);
  });
});
