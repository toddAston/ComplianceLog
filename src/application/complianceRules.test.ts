import { describe, it, expect } from "vitest";
import {
  computeRetainUntil,
  runAllComplianceChecks,
  runComplianceChecks,
} from "./complianceRules";
import type { ApplicationRecord, ContractorInputs } from "../domain/types";

type RecordOverrides = Partial<ContractorInputs> & {
  createdAt?: string;
  // v0.1 has no indoor/outdoor toggle; the rules read an optional siteType.
  siteType?: string;
  epaRegistrationCorrelationEvidenceId?: string;
};

function makeRecord(overrides: RecordOverrides = {}): ApplicationRecord {
  const {
    createdAt,
    siteType,
    epaRegistrationCorrelationEvidenceId,
    ...ci
  } = overrides;
  const contractorInputs: ContractorInputs = {
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
    rupStatus: "no",
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
    // P1 / P2 fixture baseline: a fully-classified, fully-reviewed record so
    // every rule passes. Conditional rules (noncertified actor, premixed, tank
    // mix, indoor exemption, structural exception) are intentionally NOT
    // applicable here so they `pass` via `appliesWhen`.
    applicatorCategory: "certified_commercial",
    slnNumber: "",
    productLabelRef: "https://example.com/labels/herbicide-x.pdf",
    labelVersionOrDate: "2025-10-01",
    labelConsistencyReviewed: true,
    labelCropSiteReviewed: true,
    labelTargetPestReviewed: true,
    labelRateReviewed: true,
    labelTimingMethodReviewed: true,
    labelPpeReviewed: true,
    labelReiPhiReviewed: true,
    labelDriftBufferReviewed: true,
    weatherCaptureSource: "manual",
    weatherCaptureTimestamp: "2026-05-18T07:55:00Z",
    weatherCaptureLocation: "Field 7 north corner",
    gpsLatitude: "39.06",
    gpsLongitude: "-92.33",
    ...ci,
  };
  const ciExtra = contractorInputs as {
    siteType?: string;
    epaRegistrationCorrelationEvidenceId?: string;
  };
  if (siteType !== undefined) ciExtra.siteType = siteType;
  if (epaRegistrationCorrelationEvidenceId !== undefined) {
    ciExtra.epaRegistrationCorrelationEvidenceId =
      epaRegistrationCorrelationEvidenceId;
  }
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

describe("runAllComplianceChecks", () => {
  it("returns one outcome per rule with description + citation", () => {
    const outcomes = runAllComplianceChecks(makeRecord());
    // The rule set is large and growing through phased compliance work; assert
    // a stable subset rather than the full list to keep the ordering test
    // resilient to phase additions. The source-tag invariant test in
    // src/application/compliance/sourceTags.test.ts already guards the whole set.
    const ids = new Set(outcomes.map((o) => o.ruleId));
    const expectedSubset = [
      "MISSING_AIR_TEMPERATURE",
      "MISSING_APPLICATION_DATE",
      "MISSING_APPLICATION_SITE",
      "MISSING_APPLICATOR",
      "MISSING_AREA_TREATED",
      "MISSING_AREA_UNIT",
      "MISSING_CROP_OR_SITE",
      "MISSING_END_TIME",
      "MISSING_EPA_REG",
      "MISSING_PRODUCER_REQUEST_DATE",
      "MISSING_PRODUCER_REQUEST_SIGNATURE",
      "MISSING_PRODUCER_REQUEST_TEXT",
      "MISSING_PRODUCT_NAME",
      "MISSING_RATE_OR_AMOUNT",
      "MISSING_RATE_UNIT",
      "MISSING_REQUESTER_ADDRESS",
      "MISSING_REQUESTER_NAME",
      "MISSING_SITE_ADDRESS_OR_DESCRIPTION",
      "MISSING_START_TIME",
      "MISSING_TARGET_PEST",
      "MISSING_TOTAL_MIXTURE_AMOUNT",
      "MISSING_WIND",
      "RECORD_LATE",
      "RETENTION_PERIOD",
      "RUP_UNCERTIFIED",
    ];
    for (const id of expectedSubset) {
      expect(ids.has(id), `rule ${id} present`).toBe(true);
    }
    for (const o of outcomes) {
      expect(o.description.length).toBeGreaterThan(0);
      expect(o.citationShort.length).toBeGreaterThan(0);
    }
  });

  it("marks all rules pass for a fully compliant record", () => {
    const outcomes = runAllComplianceChecks(makeRecord());
    expect(outcomes.every((o) => o.status === "pass")).toBe(true);
  });

  it("marks MISSING_WIND as fail when wind speed is empty", () => {
    const outcomes = runAllComplianceChecks(makeRecord({ windSpeed: "" }));
    const wind = outcomes.find((o) => o.ruleId === "MISSING_WIND");
    expect(wind?.status).toBe("fail");
  });

  it("marks RECORD_LATE as unknown when application date is missing", () => {
    const outcomes = runAllComplianceChecks(
      makeRecord({ applicationDate: "" })
    );
    const late = outcomes.find((o) => o.ruleId === "RECORD_LATE");
    expect(late?.status).toBe("unknown");
    expect(late?.unknownReason).toBeDefined();
  });

  it("marks RECORD_LATE as unknown when application date is unparseable", () => {
    const outcomes = runAllComplianceChecks(
      makeRecord({ applicationDate: "not-a-date" })
    );
    const late = outcomes.find((o) => o.ruleId === "RECORD_LATE");
    expect(late?.status).toBe("unknown");
  });

  it("marks RUP_UNCERTIFIED as unknown when rupStatus is unknown", () => {
    const outcomes = runAllComplianceChecks(
      makeRecord({ rupStatus: "unknown", certificationNumber: "" })
    );
    const rup = outcomes.find((o) => o.ruleId === "RUP_UNCERTIFIED");
    expect(rup?.status).toBe("unknown");
  });

  it("marks RUP_UNCERTIFIED as pass when product is not RUP even without cert", () => {
    const outcomes = runAllComplianceChecks(
      makeRecord({ rupStatus: "no", certificationNumber: "" })
    );
    const rup = outcomes.find((o) => o.ruleId === "RUP_UNCERTIFIED");
    expect(rup?.status).toBe("pass");
  });

  it("marks RUP_UNCERTIFIED as fail when RUP and no cert", () => {
    const outcomes = runAllComplianceChecks(
      makeRecord({ rupStatus: "yes", certificationNumber: "" })
    );
    const rup = outcomes.find((o) => o.ruleId === "RUP_UNCERTIFIED");
    expect(rup?.status).toBe("fail");
  });

  it("runComplianceChecks remains aligned with runAllComplianceChecks failures", () => {
    const record = makeRecord({ windSpeed: "", targetPest: "" });
    const failedIds = runAllComplianceChecks(record)
      .filter((o) => o.status === "fail")
      .map((o) => o.ruleId)
      .sort();
    const flagged = runComplianceChecks(record)
      .map((r) => r.ruleId)
      .sort();
    expect(flagged).toEqual(failedIds);
  });
});

describe("Missouri recordkeeping checks (2 CSR 70-25.120 / RSMo 281.035)", () => {
  const failing = (record: ApplicationRecord) => runComplianceChecks(record);
  const find = (record: ApplicationRecord, ruleId: string) =>
    failing(record).find((r) => r.ruleId === ruleId);

  it("1. a complete Missouri record passes the required-field checks", () => {
    const errors = failing(makeRecord()).filter((r) => r.severity === "error");
    expect(errors).toEqual([]);
  });

  it("2. missing application date fails", () => {
    const found = find(makeRecord({ applicationDate: "" }), "MISSING_APPLICATION_DATE");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("error");
  });

  it("3. missing start time fails", () => {
    const found = find(makeRecord({ startTime: "" }), "MISSING_START_TIME");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("error");
  });

  it("4. missing end time fails", () => {
    const found = find(makeRecord({ endTime: "" }), "MISSING_END_TIME");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("error");
  });

  it("5. missing product trade name fails", () => {
    const found = find(makeRecord({ productName: "" }), "MISSING_PRODUCT_NAME");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("error");
  });

  it("6. missing EPA registration number fails unless correlation evidence is present", () => {
    expect(
      find(makeRecord({ epaRegistrationNumber: "" }), "MISSING_EPA_REG")
    ).toBeDefined();
    // Documented correlation evidence satisfies the same requirement.
    expect(
      find(
        makeRecord({
          epaRegistrationNumber: "",
          epaRegistrationCorrelationEvidenceId: "corr-evidence-1",
        }),
        "MISSING_EPA_REG"
      )
    ).toBeUndefined();
  });

  it("7. an outdoor record missing wind direction fails", () => {
    const found = find(makeRecord({ windDirection: "" }), "MISSING_WIND");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("warning");
  });

  it("8. an indoor/non-outdoor record does not require outdoor weather", () => {
    const indoor = makeRecord({
      siteType: "indoor",
      windSpeed: "",
      windDirection: "",
      temperature: "",
    });
    expect(find(indoor, "MISSING_WIND")).toBeUndefined();
    expect(find(indoor, "MISSING_AIR_TEMPERATURE")).toBeUndefined();
  });

  it("9. missing treated area fails", () => {
    const found = find(makeRecord({ acresTreated: "" }), "MISSING_AREA_TREATED");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("error");
  });

  it("10. missing target pest fails", () => {
    const found = find(makeRecord({ targetPest: "" }), "MISSING_TARGET_PEST");
    expect(found).toBeDefined();
    expect(found!.severity).toBe("error");
  });

  it("11. completion more than three business days after application creates a warning", () => {
    const found = find(
      makeRecord({
        applicationDate: "2026-05-10",
        createdAt: "2026-05-18T10:00:00Z",
      }),
      "RECORD_LATE"
    );
    expect(found).toBeDefined();
    expect(found!.severity).toBe("warning");
    expect(found!.message).toMatch(/three business days/i);
  });

  it("12. retain-until metadata is the application date plus three years", () => {
    expect(computeRetainUntil("2026-05-19")).toBe("2029-05-19");
    expect(computeRetainUntil("")).toBeNull();
    expect(computeRetainUntil("not-a-date")).toBeNull();
  });

  it("13. each failing result carries an existing-style source tag", () => {
    const results = failing(
      makeRecord({
        applicationDate: "",
        startTime: "",
        productName: "",
        windDirection: "",
      })
    );
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.citation.length).toBeGreaterThan(0);
      expect(r.citationShort).toMatch(/^(2 CSR 70-25\.120|RSMo )/);
    }
  });

  it("14. RSMo 281.035 is represented as a statute source (not agency guidance)", () => {
    const retention = runAllComplianceChecks(makeRecord()).find(
      (o) => o.ruleId === "RETENTION_PERIOD"
    );
    expect(retention).toBeDefined();
    expect(retention!.citationShort).toMatch(/^RSMo /);
    expect(retention!.citationShort).not.toMatch(/CSR/);
  });

  it("15. 2 CSR 70-25.120 is represented as a regulation source", () => {
    const dateRule = runAllComplianceChecks(makeRecord({ applicationDate: "" })).find(
      (o) => o.ruleId === "MISSING_APPLICATION_DATE"
    );
    expect(dateRule).toBeDefined();
    expect(dateRule!.citationShort).toMatch(/^2 CSR 70-25\.120/);
  });
});
