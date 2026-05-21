import { describe, expect, it } from "vitest";
import { contractorInputsSchema, weatherSnapshotSchema } from "./schemas";

const baseContractor = {
  applicatorId: "applicator-x",
  applicatorName: "X",
  company: "Acme",

  farmId: "farm-1",
  farmName: "Farm 1",
  fieldId: "field-1",
  fieldName: "Field 1",
  cropOrSite: "Soy",
  acresTreated: "10",

  productId: "p-1",
  productName: "Product",
  epaRegistrationNumber: "12345-678",
  rupStatus: "no" as const,
  catalogVersion: "v1",

  applicationDate: "2026-05-19",
  startTime: "08:00",
  applicationMethod: "Ground broadcast",
  rateApplied: "1 qt/ac",
  totalAmountApplied: "10 gal",

  temperature: "72F",
  windSpeed: "5 mph",
  windDirection: "S",

  attestationConfirmed: true,

  requesterName: "Acme Producer Co.",
  requesterAddress: "1234 Main St, Columbia, MO 65201",
  siteDescription: "North 40, soybean field along Highway B",
};

describe("weatherSnapshotSchema", () => {
  it("accepts a manual snapshot with only capturedAt + source", () => {
    const ok = weatherSnapshotSchema.safeParse({
      source: "manual",
      capturedAt: "2026-05-19T12:00:00.000Z",
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a full NWS-observation snapshot", () => {
    const ok = weatherSnapshotSchema.safeParse({
      source: "nws_observation",
      stationId: "KSGF",
      observedAt: "2026-05-19T12:00:00+00:00",
      capturedAt: "2026-05-19T12:00:30.000Z",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an unknown source", () => {
    const bad = weatherSnapshotSchema.safeParse({
      source: "openweather",
      capturedAt: "2026-05-19T12:00:00.000Z",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects missing capturedAt", () => {
    const bad = weatherSnapshotSchema.safeParse({
      source: "manual",
    });
    expect(bad.success).toBe(false);
  });
});

describe("contractorInputsSchema weatherSnapshot integration", () => {
  it("accepts inputs without weatherSnapshot (backward compatible)", () => {
    const ok = contractorInputsSchema.safeParse(baseContractor);
    expect(ok.success).toBe(true);
  });

  it("accepts inputs with a weatherSnapshot", () => {
    const ok = contractorInputsSchema.safeParse({
      ...baseContractor,
      weatherSnapshot: {
        source: "nws_observation",
        stationId: "KSGF",
        observedAt: "2026-05-19T12:00:00+00:00",
        capturedAt: "2026-05-19T12:00:30.000Z",
      },
    });
    expect(ok.success).toBe(true);
  });

  it("rejects inputs with a malformed weatherSnapshot", () => {
    const bad = contractorInputsSchema.safeParse({
      ...baseContractor,
      weatherSnapshot: {
        source: "manual",
      },
    });
    expect(bad.success).toBe(false);
  });
});
