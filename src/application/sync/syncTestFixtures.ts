import type { ApplicationRecord, ContractorInputs } from "../../domain/types";

// Shared fixtures for sync tests. Not a test file (no .test suffix), so vitest's
// include glob won't try to run it.

export function buildContractorInputs(
  overrides: Partial<ContractorInputs> = {}
): ContractorInputs {
  return {
    applicatorId: "applicator-john-smith",
    applicatorName: "John Smith",
    company: "Smith Spray Services",
    certificationNumber: "MO-123456",
    farmId: "farm-north",
    farmName: "North Farm",
    fieldId: "field-7",
    fieldName: "Field 7",
    cropOrSite: "Soybeans",
    acresTreated: "42.5",
    productId: "product-example-herbicide-4l",
    productName: "Example Herbicide 4L",
    epaRegistrationNumber: "12345-678",
    rupStatus: "no",
    catalogVersion: "MO-DEMO-2026-05-19",
    applicationDate: "2026-05-19",
    startTime: "08:00",
    applicationMethod: "Ground broadcast",
    rateApplied: "1 qt/ac",
    totalAmountApplied: "10 gal",
    targetPest: "Waterhemp",
    temperature: "72F",
    windSpeed: "5 mph",
    windDirection: "S",
    attestationConfirmed: true,

    requesterName: "Acme Producer Co.",
    requesterAddress: "1234 Main St, Columbia, MO 65201",
    siteDescription: "North 40, soybean field along Highway B",

    applicatorCategory: "certified_commercial",
    slnNumber: "",

    ...overrides,
  };
}

export function buildRecord(
  overrides: Partial<ApplicationRecord> = {}
): ApplicationRecord {
  const createdAt = "2026-05-19T08:00:00.000Z";
  return {
    id: crypto.randomUUID(),
    organizationId: "org-demo-semofarms",
    workflowStatus: "draft",
    syncStatus: "local_only",
    contractorInputs: buildContractorInputs(),
    managerInputs: { reviewStatus: "not_reviewed" },
    system: {
      createdAt,
      createdOffline: true,
      lastUpdatedAt: createdAt,
    },
    complianceReviewRequired: false,
    ...overrides,
  };
}
