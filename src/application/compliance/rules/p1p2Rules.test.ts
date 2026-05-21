import { describe, it, expect } from "vitest";
import { runAllComplianceChecks, runComplianceChecks } from "../index";
import type { ApplicationRecord, ContractorInputs } from "../../../domain/types";

type RecordOverrides = Partial<ContractorInputs> & {
  createdAt?: string;
  workflowStatus?: ApplicationRecord["workflowStatus"];
  siteType?: string;
  // P1
  applicatorCategory?: string;
  noncertifiedApplicatorName?: string;
  noncertifiedApplicatorLicense?: string;
  technicianName?: string;
  technicianLicense?: string;
  traineeName?: string;
  indoorSpotCrackCrevice?: boolean;
  slnNumber?: string;
  epaRegistrationCorrelationEvidenceId?: string;
  isPremixed?: boolean;
  premixedAmountUsed?: string;
  premixedActualRate?: string;
  structuralTermiteWithin10ft?: boolean;
  productLabelRef?: string;
  labelVersionOrDate?: string;
  labelConsistencyReviewed?: boolean;
  labelCropSiteReviewed?: boolean;
  labelTargetPestReviewed?: boolean;
  labelRateReviewed?: boolean;
  labelTimingMethodReviewed?: boolean;
  labelPpeReviewed?: boolean;
  labelReiPhiReviewed?: boolean;
  labelDriftBufferReviewed?: boolean;
  // P2
  tankMixProducts?: Array<{
    productName?: string;
    epaRegistrationNumber?: string;
    applicationRate?: string;
    totalAmount?: string;
  }>;
  supervisorIdentified?: boolean;
  workOrderAcknowledged?: boolean;
  labelInPossessionAcknowledged?: boolean;
  equipmentReadinessAcknowledged?: boolean;
  weatherCaptureSource?: string;
  weatherCaptureTimestamp?: string;
  weatherCaptureLocation?: string;
  gpsLatitude?: string;
  gpsLongitude?: string;
};

function makeRecord(overrides: RecordOverrides = {}): ApplicationRecord {
  const { createdAt, workflowStatus, ...rest } = overrides;
  const ci = {
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
    requesterAddress: "1234 Main St",
    siteDescription: "North 40",
    applicatorCategory: "certified_commercial",
    slnNumber: "",
    ...rest,
  } as ContractorInputs;
  return {
    id: "rec-1",
    organizationId: "org-1",
    workflowStatus: workflowStatus ?? "draft",
    syncStatus: "local_only",
    contractorInputs: ci,
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

const outcome = (record: ApplicationRecord, ruleId: string) =>
  runAllComplianceChecks(record).find((o) => o.ruleId === ruleId);

describe("chain-of-custody rules (matrix #73, #74)", () => {
  it("MISSING_SUBMITTER_IDENTITY does not apply to drafts", () => {
    expect(outcome(makeRecord({ submittedBy: undefined }), "MISSING_SUBMITTER_IDENTITY")?.status).toBe("pass");
  });
  it("MISSING_SUBMITTER_IDENTITY fails on submitted records without a submitter", () => {
    const r = makeRecord({
      workflowStatus: "submitted",
      submittedBy: undefined,
      submittedAt: "2026-05-18T08:30:00Z",
    });
    expect(find(r, "MISSING_SUBMITTER_IDENTITY")).toBeDefined();
  });
  it("MISSING_SUBMISSION_TIMESTAMP fails on submitted records without a timestamp", () => {
    const r = makeRecord({
      workflowStatus: "submitted",
      submittedBy: "Test User",
      submittedAt: undefined,
    });
    expect(find(r, "MISSING_SUBMISSION_TIMESTAMP")).toBeDefined();
  });
  it("both pass on a properly attributed submitted record", () => {
    const r = makeRecord({
      workflowStatus: "submitted",
      submittedBy: "Test User",
      submittedAt: "2026-05-18T08:30:00Z",
    });
    expect(find(r, "MISSING_SUBMITTER_IDENTITY")).toBeUndefined();
    expect(find(r, "MISSING_SUBMISSION_TIMESTAMP")).toBeUndefined();
  });
});

describe("applicator category & duty (matrix #1-#4)", () => {
  it("APPLICATOR_CATEGORY_UNKNOWN fires when category is undefined", () => {
    expect(find(makeRecord({ applicatorCategory: undefined }), "APPLICATOR_CATEGORY_UNKNOWN")).toBeDefined();
  });
  it("APPLICATOR_CATEGORY_UNKNOWN fires when category is 'unknown'", () => {
    expect(find(makeRecord({ applicatorCategory: "unknown" }), "APPLICATOR_CATEGORY_UNKNOWN")).toBeDefined();
  });
  it("COMMERCIAL_RECORD_DUTY applies and passes for a certified-commercial record with name + company", () => {
    expect(outcome(makeRecord(), "COMMERCIAL_RECORD_DUTY")?.status).toBe("pass");
  });
  it("COMMERCIAL_RECORD_DUTY does not apply to private records", () => {
    expect(outcome(makeRecord({ applicatorCategory: "private" }), "COMMERCIAL_RECORD_DUTY")?.status).toBe("pass");
  });
  it("NONCOMMERCIAL_PUBLIC_RUP_DUTY only applies to noncommercial/public + RUP", () => {
    expect(
      outcome(
        makeRecord({ applicatorCategory: "public_operator", rupStatus: "yes" }),
        "NONCOMMERCIAL_PUBLIC_RUP_DUTY"
      )?.status
    ).toBe("pass");
    expect(
      outcome(
        makeRecord({ applicatorCategory: "public_operator", rupStatus: "no" }),
        "NONCOMMERCIAL_PUBLIC_RUP_DUTY"
      )?.status
    ).toBe("pass"); // not applicable → pass
  });
  it("PESTICIDE_TYPE_UNKNOWN is unknown when rupStatus is 'unknown'", () => {
    expect(outcome(makeRecord({ rupStatus: "unknown" }), "PESTICIDE_TYPE_UNKNOWN")?.status).toBe("unknown");
  });
});

describe("conditional actor names/licenses (matrix #10-#15)", () => {
  it("noncertified rules don't fire for certified categories", () => {
    expect(outcome(makeRecord(), "MISSING_NONCERTIFIED_APPLICATOR_NAME")?.status).toBe("pass");
    expect(outcome(makeRecord(), "MISSING_TECHNICIAN_NAME")?.status).toBe("pass");
    expect(outcome(makeRecord(), "MISSING_TRAINEE_NAME")?.status).toBe("pass");
  });
  it("MISSING_NONCERTIFIED_APPLICATOR_NAME fires for noncertified without name", () => {
    expect(find(makeRecord({ applicatorCategory: "noncertified" }), "MISSING_NONCERTIFIED_APPLICATOR_NAME")).toBeDefined();
  });
  it("noncertified RUP requires both name and license", () => {
    const r = makeRecord({ applicatorCategory: "noncertified_rup" });
    expect(find(r, "MISSING_NONCERTIFIED_RUP_APPLICATOR_NAME")).toBeDefined();
    expect(find(r, "MISSING_NONCERTIFIED_RUP_APPLICATOR_LICENSE")).toBeDefined();
  });
  it("technician category requires both name and license", () => {
    const r = makeRecord({ applicatorCategory: "technician" });
    expect(find(r, "MISSING_TECHNICIAN_NAME")).toBeDefined();
    expect(find(r, "MISSING_TECHNICIAN_LICENSE")).toBeDefined();
  });
  it("trainee category requires the trainee name only", () => {
    const r = makeRecord({ applicatorCategory: "trainee" });
    expect(find(r, "MISSING_TRAINEE_NAME")).toBeDefined();
    expect(find(r, "MISSING_TECHNICIAN_LICENSE")).toBeUndefined();
  });
});

describe("indoor exemption + structural exception (matrix #26, #45)", () => {
  it("INDOOR_EXEMPTION_NOT_CLASSIFIED does not apply to outdoor records", () => {
    expect(outcome(makeRecord(), "INDOOR_EXEMPTION_NOT_CLASSIFIED")?.status).toBe("pass");
  });
  it("INDOOR_EXEMPTION_NOT_CLASSIFIED fires for indoor record without a decision", () => {
    expect(find(makeRecord({ siteType: "indoor" }), "INDOOR_EXEMPTION_NOT_CLASSIFIED")).toBeDefined();
  });
  it("INDOOR_EXEMPTION_NOT_CLASSIFIED passes when classified true or false", () => {
    expect(find(makeRecord({ siteType: "indoor", indoorSpotCrackCrevice: true }), "INDOOR_EXEMPTION_NOT_CLASSIFIED")).toBeUndefined();
    expect(find(makeRecord({ siteType: "indoor", indoorSpotCrackCrevice: false }), "INDOOR_EXEMPTION_NOT_CLASSIFIED")).toBeUndefined();
  });
  it("STRUCTURAL_TERMITE_EXCEPTION_NOT_CLASSIFIED fires for structural site without a decision", () => {
    expect(find(makeRecord({ siteType: "structural" }), "STRUCTURAL_TERMITE_EXCEPTION_NOT_CLASSIFIED")).toBeDefined();
  });
});

describe("premixed group (matrix #41-#43)", () => {
  it("does not fire when isPremixed is undefined or false", () => {
    expect(outcome(makeRecord(), "MISSING_PREMIXED_AMOUNT")?.status).toBe("pass");
    expect(outcome(makeRecord({ isPremixed: false }), "MISSING_PREMIXED_AMOUNT")?.status).toBe("pass");
  });
  it("fires both rules when isPremixed=true and sub-fields are missing", () => {
    const r = makeRecord({ isPremixed: true });
    expect(find(r, "MISSING_PREMIXED_AMOUNT")).toBeDefined();
    expect(find(r, "MISSING_PREMIXED_ACTUAL_RATE")).toBeDefined();
  });
  it("clears when both sub-fields are present", () => {
    const r = makeRecord({
      isPremixed: true,
      premixedAmountUsed: "3 gal",
      premixedActualRate: "1 oz/100 sqft",
    });
    expect(find(r, "MISSING_PREMIXED_AMOUNT")).toBeUndefined();
    expect(find(r, "MISSING_PREMIXED_ACTUAL_RATE")).toBeUndefined();
  });
});

describe("label verification family (matrix #35, #36, #56-#64)", () => {
  it("LABEL_NOT_ATTACHED is `unknown`, not `fail`, when no label is attached", () => {
    expect(outcome(makeRecord({ productLabelRef: undefined }), "LABEL_NOT_ATTACHED")?.status).toBe("unknown");
    // Not surfaced in failures (so it doesn't block the lock gate)…
    expect(find(makeRecord({ productLabelRef: undefined }), "LABEL_NOT_ATTACHED")).toBeUndefined();
  });
  it("LABEL_NOT_ATTACHED passes when a label is attached", () => {
    expect(outcome(makeRecord({ productLabelRef: "https://example.com/label.pdf" }), "LABEL_NOT_ATTACHED")?.status).toBe("pass");
  });
  it("LABEL_VERSION_OR_DATE_MISSING only applies when a label is attached", () => {
    expect(outcome(makeRecord({ productLabelRef: undefined }), "LABEL_VERSION_OR_DATE_MISSING")?.status).toBe("pass");
    expect(
      outcome(makeRecord({ productLabelRef: "https://x", labelVersionOrDate: undefined }), "LABEL_VERSION_OR_DATE_MISSING")?.status
    ).toBe("unknown");
  });
  it("review acknowledgments resolve unknown -> pass", () => {
    expect(outcome(makeRecord({ labelConsistencyReviewed: undefined }), "LABEL_CONSISTENCY_NOT_REVIEWED")?.status).toBe("unknown");
    expect(outcome(makeRecord({ labelConsistencyReviewed: true }), "LABEL_CONSISTENCY_NOT_REVIEWED")?.status).toBe("pass");
  });
  it("LABEL_DRIFT_BUFFER_NOT_REVIEWED only applies to outdoor records", () => {
    expect(outcome(makeRecord({ siteType: "indoor" }), "LABEL_DRIFT_BUFFER_NOT_REVIEWED")?.status).toBe("pass");
  });
});

describe("tank mix (matrix #65-#67)", () => {
  it("none of the tank-mix rules apply when tankMixProducts is empty/undefined", () => {
    expect(outcome(makeRecord(), "TANK_MIX_PRODUCT_LIST_INCOMPLETE")?.status).toBe("pass");
    expect(outcome(makeRecord(), "TANK_MIX_MISSING_EPA")?.status).toBe("pass");
    expect(outcome(makeRecord(), "TANK_MIX_MISSING_RATE_OR_AMOUNT")?.status).toBe("pass");
  });
  it("TANK_MIX_PRODUCT_LIST_INCOMPLETE fires when an entry has no product name", () => {
    const r = makeRecord({
      tankMixProducts: [
        { productName: "Product A", epaRegistrationNumber: "11-22", applicationRate: "1 qt/ac" },
        { productName: undefined, epaRegistrationNumber: "33-44" },
      ],
    });
    expect(find(r, "TANK_MIX_PRODUCT_LIST_INCOMPLETE")).toBeDefined();
  });
  it("TANK_MIX_MISSING_EPA fires when any entry lacks an EPA number", () => {
    const r = makeRecord({
      tankMixProducts: [{ productName: "Product A", applicationRate: "1 qt/ac" }],
    });
    expect(find(r, "TANK_MIX_MISSING_EPA")).toBeDefined();
  });
  it("TANK_MIX_MISSING_RATE_OR_AMOUNT passes if either rate or amount is recorded per entry", () => {
    const r = makeRecord({
      tankMixProducts: [
        { productName: "A", epaRegistrationNumber: "11-22", applicationRate: "1 qt/ac" },
        { productName: "B", epaRegistrationNumber: "33-44", totalAmount: "5 gal" },
      ],
    });
    expect(find(r, "TANK_MIX_MISSING_RATE_OR_AMOUNT")).toBeUndefined();
  });
  it("TANK_MIX_MISSING_RATE_OR_AMOUNT fires when an entry has neither rate nor amount", () => {
    const r = makeRecord({
      tankMixProducts: [{ productName: "A", epaRegistrationNumber: "11-22" }],
    });
    expect(find(r, "TANK_MIX_MISSING_RATE_OR_AMOUNT")).toBeDefined();
  });
});

describe("noncertified supervision (matrix #68-#71)", () => {
  it("none of the supervision rules apply for certified-commercial categories", () => {
    expect(outcome(makeRecord(), "SUPERVISOR_NOT_IDENTIFIED")?.status).toBe("pass");
    expect(outcome(makeRecord(), "WORK_ORDER_NOT_ACKNOWLEDGED")?.status).toBe("pass");
  });
  it("supervision rules are `unknown` (visible) but non-blocking for noncertified records without acks", () => {
    const r = makeRecord({ applicatorCategory: "noncertified" });
    expect(outcome(r, "SUPERVISOR_NOT_IDENTIFIED")?.status).toBe("unknown");
    // unknown does not appear in failures, so it does not block lock.
    expect(find(r, "SUPERVISOR_NOT_IDENTIFIED")).toBeUndefined();
  });
  it("supervision rules pass once acknowledged", () => {
    const r = makeRecord({
      applicatorCategory: "noncertified",
      supervisorIdentified: true,
      workOrderAcknowledged: true,
      labelInPossessionAcknowledged: true,
      equipmentReadinessAcknowledged: true,
    });
    for (const id of [
      "SUPERVISOR_NOT_IDENTIFIED",
      "WORK_ORDER_NOT_ACKNOWLEDGED",
      "LABEL_POSSESSION_NOT_ACKNOWLEDGED",
      "EQUIPMENT_READINESS_NOT_ACKNOWLEDGED",
    ]) {
      expect(outcome(r, id)?.status).toBe("pass");
    }
  });
});

describe("evidence quality (matrix #49-#51, #72)", () => {
  it("weather-quality rules are `unknown` for outdoor records lacking capture fields", () => {
    expect(outcome(makeRecord(), "WEATHER_CAPTURE_SOURCE_UNKNOWN")?.status).toBe("unknown");
    expect(outcome(makeRecord(), "WEATHER_CAPTURE_TIMESTAMP_UNKNOWN")?.status).toBe("unknown");
    expect(outcome(makeRecord(), "WEATHER_CAPTURE_LOCATION_UNKNOWN")?.status).toBe("unknown");
  });
  it("weather-quality rules pass when manual capture fields are provided", () => {
    const r = makeRecord({
      weatherCaptureSource: "manual",
      weatherCaptureTimestamp: "2026-05-18T07:55:00Z",
      weatherCaptureLocation: "Field 7",
    });
    expect(outcome(r, "WEATHER_CAPTURE_SOURCE_UNKNOWN")?.status).toBe("pass");
    expect(outcome(r, "WEATHER_CAPTURE_TIMESTAMP_UNKNOWN")?.status).toBe("pass");
    expect(outcome(r, "WEATHER_CAPTURE_LOCATION_UNKNOWN")?.status).toBe("pass");
  });
  it("weather-quality rules do not apply to indoor records", () => {
    expect(outcome(makeRecord({ siteType: "indoor" }), "WEATHER_CAPTURE_SOURCE_UNKNOWN")?.status).toBe("pass");
  });
  it("GPS_EVIDENCE_UNKNOWN is `unknown` (visible, non-blocking) when no GPS is captured", () => {
    expect(outcome(makeRecord(), "GPS_EVIDENCE_UNKNOWN")?.status).toBe("unknown");
    expect(find(makeRecord(), "GPS_EVIDENCE_UNKNOWN")).toBeUndefined();
  });
  it("GPS_EVIDENCE_UNKNOWN passes when both lat and lon are recorded", () => {
    expect(outcome(makeRecord({ gpsLatitude: "39.06", gpsLongitude: "-92.33" }), "GPS_EVIDENCE_UNKNOWN")?.status).toBe("pass");
  });
});
