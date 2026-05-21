import { describe, it, expect } from "vitest";
import { runAllComplianceChecks, runComplianceChecks } from "../index";
import type { ApplicationRecord, ContractorInputs } from "../../../domain/types";

type RecordOverrides = Partial<ContractorInputs> & {
  createdAt?: string;
  siteType?: string;
  // The matrix-driven optional fields we attach via the loose ContractorInputs
  // typing (they're declared optional on the Zod schema; tests cast them in).
  requesterName?: string;
  requesterAddress?: string;
  siteAddress?: string;
  siteDescription?: string;
  areaTreatedValue?: string;
  areaUnit?: string;
  applicationRateValue?: string;
  rateUnit?: string;
  mixtureRate?: string;
  totalMixtureAmount?: string;
  lessThanLabelConcentration?: boolean;
  producerRequestText?: string;
  producerRequestSignature?: string;
  producerRequestDate?: string;
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
    // Baseline P0 fields (the "fully compliant" starting point).
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

const find = (record: ApplicationRecord, ruleId: string) =>
  runComplianceChecks(record).find((r) => r.ruleId === ruleId);

describe("MISSING_REQUESTER_NAME / MISSING_REQUESTER_ADDRESS (matrix #19, #20)", () => {
  it("passes when both are present", () => {
    const r = makeRecord();
    expect(find(r, "MISSING_REQUESTER_NAME")).toBeUndefined();
    expect(find(r, "MISSING_REQUESTER_ADDRESS")).toBeUndefined();
  });
  it("fails when requester name is missing", () => {
    const r = makeRecord({ requesterName: undefined });
    const found = find(r, "MISSING_REQUESTER_NAME");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("error");
    expect(found!.citationShort).toBe("2 CSR 70-25.120(D)");
  });
  it("fails when requester address is whitespace-only", () => {
    const r = makeRecord({ requesterAddress: "   " });
    expect(find(r, "MISSING_REQUESTER_ADDRESS")).toBeDefined();
  });
});

describe("MISSING_SITE_ADDRESS_OR_DESCRIPTION (matrix #21, #22)", () => {
  it("passes when only siteDescription is present", () => {
    const r = makeRecord({ siteAddress: undefined });
    expect(find(r, "MISSING_SITE_ADDRESS_OR_DESCRIPTION")).toBeUndefined();
  });
  it("passes when only siteAddress is present", () => {
    const r = makeRecord({
      siteDescription: undefined,
      siteAddress: "5678 Rural Rd, Boone County, MO",
    });
    expect(find(r, "MISSING_SITE_ADDRESS_OR_DESCRIPTION")).toBeUndefined();
  });
  it("fails when neither is present", () => {
    const r = makeRecord({
      siteAddress: undefined,
      siteDescription: undefined,
    });
    const found = find(r, "MISSING_SITE_ADDRESS_OR_DESCRIPTION");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("error");
  });
  it("fails when both are whitespace-only", () => {
    const r = makeRecord({ siteAddress: " ", siteDescription: "" });
    expect(find(r, "MISSING_SITE_ADDRESS_OR_DESCRIPTION")).toBeDefined();
  });
});

describe("structured measurements (matrix #25, #40, mixture amount)", () => {
  it("MISSING_AREA_UNIT does not apply when no structured area value is recorded", () => {
    const outcomes = runAllComplianceChecks(makeRecord());
    const found = outcomes.find((o) => o.ruleId === "MISSING_AREA_UNIT");
    expect(found?.status).toBe("pass");
  });
  it("MISSING_AREA_UNIT fires when structured value is present but unit is not", () => {
    const r = makeRecord({ areaTreatedValue: "40", areaUnit: undefined });
    expect(find(r, "MISSING_AREA_UNIT")).toBeDefined();
  });
  it("MISSING_AREA_UNIT passes when both value and unit are present", () => {
    const r = makeRecord({ areaTreatedValue: "40", areaUnit: "acres" });
    expect(find(r, "MISSING_AREA_UNIT")).toBeUndefined();
  });
  it("MISSING_RATE_UNIT fires when structured rate value present but unit missing", () => {
    const r = makeRecord({ applicationRateValue: "22", rateUnit: undefined });
    expect(find(r, "MISSING_RATE_UNIT")).toBeDefined();
  });
  it("MISSING_TOTAL_MIXTURE_AMOUNT fires when a mixture rate is recorded without a total", () => {
    const r = makeRecord({ mixtureRate: "2 qt/100 gal", totalMixtureAmount: undefined });
    expect(find(r, "MISSING_TOTAL_MIXTURE_AMOUNT")).toBeDefined();
  });
  it("MISSING_TOTAL_MIXTURE_AMOUNT does not fire when no mixture rate is recorded", () => {
    const outcomes = runAllComplianceChecks(makeRecord());
    const found = outcomes.find((o) => o.ruleId === "MISSING_TOTAL_MIXTURE_AMOUNT");
    expect(found?.status).toBe("pass");
  });
});

describe("lesser-than-label producer-request group (matrix #52-#55)", () => {
  it("does not fire any sub-field rule when the flag is off", () => {
    const outcomes = runAllComplianceChecks(makeRecord());
    expect(
      outcomes.find((o) => o.ruleId === "MISSING_PRODUCER_REQUEST_TEXT")?.status
    ).toBe("pass");
    expect(
      outcomes.find((o) => o.ruleId === "MISSING_PRODUCER_REQUEST_SIGNATURE")?.status
    ).toBe("pass");
    expect(
      outcomes.find((o) => o.ruleId === "MISSING_PRODUCER_REQUEST_DATE")?.status
    ).toBe("pass");
  });

  it("fires all three sub-field rules when the flag is on and sub-fields are empty", () => {
    const r = makeRecord({ lessThanLabelConcentration: true });
    expect(find(r, "MISSING_PRODUCER_REQUEST_TEXT")).toBeDefined();
    expect(find(r, "MISSING_PRODUCER_REQUEST_SIGNATURE")).toBeDefined();
    expect(find(r, "MISSING_PRODUCER_REQUEST_DATE")).toBeDefined();
  });

  it("clears only the sub-fields that are filled in (partial fill)", () => {
    const r = makeRecord({
      lessThanLabelConcentration: true,
      producerRequestText: "Producer requested 0.75× label rate.",
      producerRequestSignature: "J. Producer",
      // date intentionally missing
    });
    expect(find(r, "MISSING_PRODUCER_REQUEST_TEXT")).toBeUndefined();
    expect(find(r, "MISSING_PRODUCER_REQUEST_SIGNATURE")).toBeUndefined();
    expect(find(r, "MISSING_PRODUCER_REQUEST_DATE")).toBeDefined();
  });

  it("clears all three when the flag is on and all sub-fields are filled", () => {
    const r = makeRecord({
      lessThanLabelConcentration: true,
      producerRequestText: "Producer requested 0.75× label rate.",
      producerRequestSignature: "J. Producer",
      producerRequestDate: "2026-05-17",
    });
    expect(find(r, "MISSING_PRODUCER_REQUEST_TEXT")).toBeUndefined();
    expect(find(r, "MISSING_PRODUCER_REQUEST_SIGNATURE")).toBeUndefined();
    expect(find(r, "MISSING_PRODUCER_REQUEST_DATE")).toBeUndefined();
  });
});

describe("applicability: rules whose appliesWhen returns false report as pass, not fail", () => {
  it("the lesser-than-label group is `pass`, not `fail`, when the flag is off", () => {
    const outcomes = runAllComplianceChecks(makeRecord());
    const ids = [
      "MISSING_PRODUCER_REQUEST_TEXT",
      "MISSING_PRODUCER_REQUEST_SIGNATURE",
      "MISSING_PRODUCER_REQUEST_DATE",
    ];
    for (const id of ids) {
      const o = outcomes.find((x) => x.ruleId === id);
      expect(o?.status).toBe("pass");
    }
  });
});
