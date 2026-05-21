import { describe, it, expect } from "vitest";
import { runAllComplianceChecks } from "../index";
import { directSupervisionRules } from "./directSupervision";
import type { ApplicationRecord, ContractorInputs } from "../../../domain/types";

type RecordOverrides = Partial<ContractorInputs> & {
  applicatorCategory?: string;
  supervisorPhoneAvailable?: boolean;
  supervisorOnSiteIfLabelRequires?: boolean;
  workOrderMinimumContentVerified?: boolean;
};

function makeRecord(overrides: RecordOverrides = {}): ApplicationRecord {
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
    ...overrides,
  } as ContractorInputs;
  return {
    id: "rec-1",
    organizationId: "org-1",
    workflowStatus: "draft",
    syncStatus: "local_only",
    contractorInputs: ci,
    managerInputs: { reviewStatus: "not_reviewed" },
    system: {
      createdAt: "2026-05-18T10:00:00Z",
      createdOffline: true,
      lastUpdatedAt: "2026-05-18T10:00:00Z",
    },
    complianceReviewRequired: false,
  };
}

const outcome = (record: ApplicationRecord, ruleId: string) =>
  runAllComplianceChecks(record).find((o) => o.ruleId === ruleId);

const NEW_RULE_IDS = [
  "SUPERVISOR_PHONE_NOT_AVAILABLE",
  "SUPERVISOR_NOT_ON_SITE_WHEN_LABEL_REQUIRES",
  "WORK_ORDER_MINIMUM_CONTENT_NOT_VERIFIED",
] as const;

describe("direct-supervision rules (2 CSR 70-25.010(3)(C))", () => {
  it("emit `unknown` for every rule when a noncertified actor is present and no acks given", () => {
    const r = makeRecord({ applicatorCategory: "noncertified" });
    for (const id of NEW_RULE_IDS) {
      const o = outcome(r, id);
      expect(o?.status).toBe("unknown");
      expect(o?.resultCode).toBe("NEEDS_REVIEW");
    }
  });

  it("emit `unknown` for trainees as well (gate matches noncertified|trainee|technician)", () => {
    const r = makeRecord({ applicatorCategory: "trainee" });
    for (const id of NEW_RULE_IDS) {
      expect(outcome(r, id)?.status).toBe("unknown");
    }
  });

  it("emit `unknown` for technicians as well", () => {
    const r = makeRecord({ applicatorCategory: "technician" });
    for (const id of NEW_RULE_IDS) {
      expect(outcome(r, id)?.status).toBe("unknown");
    }
  });

  it("each rule transitions to `pass` only when its own ack is ticked", () => {
    const phoneOnly = makeRecord({
      applicatorCategory: "noncertified",
      supervisorPhoneAvailable: true,
    });
    expect(outcome(phoneOnly, "SUPERVISOR_PHONE_NOT_AVAILABLE")?.status).toBe("pass");
    expect(outcome(phoneOnly, "SUPERVISOR_NOT_ON_SITE_WHEN_LABEL_REQUIRES")?.status).toBe("unknown");
    expect(outcome(phoneOnly, "WORK_ORDER_MINIMUM_CONTENT_NOT_VERIFIED")?.status).toBe("unknown");
  });

  it("all three rules `pass` once every ack is ticked", () => {
    const r = makeRecord({
      applicatorCategory: "noncertified",
      supervisorPhoneAvailable: true,
      supervisorOnSiteIfLabelRequires: true,
      workOrderMinimumContentVerified: true,
    });
    for (const id of NEW_RULE_IDS) {
      expect(outcome(r, id)?.status).toBe("pass");
    }
  });

  it("all three rules `pass` (not applicable) for certified_commercial actors", () => {
    const r = makeRecord({ applicatorCategory: "certified_commercial" });
    for (const id of NEW_RULE_IDS) {
      expect(outcome(r, id)?.status).toBe("pass");
    }
  });

  it("the rules are `unknown` (visible) but non-blocking — they never enter the failing list", () => {
    const r = makeRecord({ applicatorCategory: "noncertified" });
    const fails = runAllComplianceChecks(r).filter((o) => o.status === "fail");
    for (const id of NEW_RULE_IDS) {
      expect(fails.find((o) => o.ruleId === id)).toBeUndefined();
    }
  });

  it("citation_short values match the regulation subsections exactly", () => {
    const byId = Object.fromEntries(
      directSupervisionRules.map((r) => [r.ruleId, r.citationShort])
    );
    expect(byId["SUPERVISOR_PHONE_NOT_AVAILABLE"]).toBe("2 CSR 70-25.010(3)(C)(7)");
    expect(byId["SUPERVISOR_NOT_ON_SITE_WHEN_LABEL_REQUIRES"]).toBe("2 CSR 70-25.010(3)(C)(8)");
    expect(byId["WORK_ORDER_MINIMUM_CONTENT_NOT_VERIFIED"]).toBe("2 CSR 70-25.010(3)(C)(3)");
  });
});
