import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "./applicationRecordService";
import { exportLockedApplicationRecord } from "./applicationRecordExport";
import { renderApplicationRecordPdf } from "./applicationRecordPdf";
import { APPRIL_LAYOUT } from "./apprilLayout";
import { DEMO_ORG_ID, seedDemoData } from "../db/seed";
import type { ContractorInputs } from "../domain/types";

const TEST_APPLICATOR: ActorContext = {
  userId: "user-test-applicator",
  displayName: "Test Applicator",
};

const TEST_MANAGER: ActorContext = {
  userId: "user-test-manager",
  displayName: "Test Manager",
};

const buildContractorInputs = (
  overrides: Partial<ContractorInputs> = {}
): ContractorInputs => ({
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

  temperature: "72F",
  windSpeed: "5 mph",
  windDirection: "S",

  attestationConfirmed: true,
  ...overrides,
});

async function seedLockedExport() {
  const draft = await createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(),
    },
    TEST_APPLICATOR
  );
  await submitApplicationRecord(draft.id, TEST_APPLICATOR);
  const locked = await acceptAndLockApplicationRecord(
    draft.id,
    TEST_MANAGER,
    "Looks good."
  );
  return exportLockedApplicationRecord(locked.id);
}

async function blobMagic(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return new TextDecoder("latin1").decode(buffer.slice(0, 5));
}

async function blobAsLatin1(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return new TextDecoder("latin1").decode(buffer);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

describe("renderApplicationRecordPdf", () => {
  it("returns a Blob whose contents start with the PDF magic number", async () => {
    const exportPayload = await seedLockedExport();
    const { blob } = renderApplicationRecordPdf(exportPayload);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(await blobMagic(blob)).toBe("%PDF-");
  });

  it("derives a record-id-bearing file name", async () => {
    const exportPayload = await seedLockedExport();
    const { fileName } = renderApplicationRecordPdf(exportPayload);
    expect(fileName.startsWith("application-record-")).toBe(true);
    expect(fileName.endsWith(".pdf")).toBe(true);
    expect(fileName).toContain(exportPayload.recordId);
  });

  it("renders every APPRIL section title plus the status history", async () => {
    const exportPayload = await seedLockedExport();
    const { blob } = renderApplicationRecordPdf(exportPayload);
    const text = await blobAsLatin1(blob);
    for (const section of APPRIL_LAYOUT.sections) {
      expect(text.includes(section.title)).toBe(true);
    }
    expect(text.includes("Status history")).toBe(true);
  });

  it("renders core contractor input values from the snapshot", async () => {
    const exportPayload = await seedLockedExport();
    const { blob } = renderApplicationRecordPdf(exportPayload);
    const text = await blobAsLatin1(blob);
    expect(text).toContain("John Smith");
    expect(text).toContain("North Farm");
    expect(text).toContain("Field 7");
    expect(text).toContain("12345-678");
    expect(text).toContain("Example Herbicide 4L");
  });
});
