import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "./applicationRecordService";
import {
  exportLockedApplicationRecord,
  type LockedApplicationRecordExport,
} from "./applicationRecordExport";
import { renderApplicationRecordPdf } from "./applicationRecordPdf";
import { APPRIL_LAYOUT } from "./apprilLayout";
import { DEMO_ORG_ID, seedDemoData } from "../db/seed";
import type { ContractorInputs } from "../domain/types";

function buildSyntheticExport(
  overrides: Partial<LockedApplicationRecordExport> = {}
): LockedApplicationRecordExport {
  return {
    exportSchemaVersion: "v1",
    recordId: "rec-synthetic-001",
    organizationId: "org-synthetic",
    workflowStatus: "locked",
    contractorInputs: {
      applicatorId: "a1",
      applicatorName: "Jane Applicator",
      company: "Synthetic Spray Co",
      farmId: "f1",
      farmName: "Synthetic Farm",
      fieldId: "fs1",
      fieldName: "South 40",
      cropOrSite: "Corn",
      acresTreated: "100",
      productName: "Synthetic Product",
      epaRegistrationNumber: "00000-001",
      rupStatus: "no",
      applicationDate: "2026-05-19",
      startTime: "07:00",
      applicationMethod: "Aerial",
      rateApplied: "2 pt/ac",
      totalAmountApplied: "25 gal",
      temperature: "70F",
      windSpeed: "3 mph",
      windDirection: "NW",
      attestationConfirmed: true,
    },
    productSnapshot: {
      id: "ps1",
      applicationRecordId: "rec-synthetic-001",
      sourceProductId: "p1",
      productName: "Synthetic Product",
      epaRegistrationNumber: "00000-001",
      rupStatus: "no",
      catalogVersion: "SYN-2026-05-19",
      snapshotCreatedAt: "2026-05-19T12:00:00.000Z",
    },
    managerReview: {
      reviewedBy: "Test Manager",
      reviewedAt: "2026-05-19T13:00:00.000Z",
    },
    system: {
      createdAt: "2026-05-19T11:00:00.000Z",
      createdOffline: true,
      lockedAt: "2026-05-19T13:30:00.000Z",
      catalogVersion: "SYN-2026-05-19",
    },
    events: [],
    ...overrides,
  };
}

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

  it("still renders labels for absent optional fields", async () => {
    const payload = buildSyntheticExport();
    const { blob } = renderApplicationRecordPdf(payload);
    const text = await blobAsLatin1(blob);
    expect(text).toContain("Certification #");
    expect(text).toContain("End time");
    expect(text).toContain("Target pest");
    expect(text).toContain("Weather notes");
    expect(text).toContain("Review notes");
  });

  it('renders "(no events recorded)" when the event log is empty', async () => {
    const payload = buildSyntheticExport({ events: [] });
    const { blob } = renderApplicationRecordPdf(payload);
    const text = await blobAsLatin1(blob);
    expect(text).toContain("no events recorded");
  });

  it("renders boolean system flags as Yes/No", async () => {
    const onlineExport = buildSyntheticExport({
      system: {
        createdAt: "2026-05-19T11:00:00.000Z",
        createdOffline: false,
        lockedAt: "2026-05-19T13:30:00.000Z",
        catalogVersion: "SYN-2026-05-19",
      },
    });
    const offlineExport = buildSyntheticExport();

    const { blob: onlineBlob } = renderApplicationRecordPdf(onlineExport);
    const { blob: offlineBlob } = renderApplicationRecordPdf(offlineExport);

    const onlineText = await blobAsLatin1(onlineBlob);
    const offlineText = await blobAsLatin1(offlineBlob);

    expect(onlineText.includes("(No)")).toBe(true);
    expect(offlineText.includes("(Yes)")).toBe(true);
  });

  it("renders manager review notes when present", async () => {
    const payload = buildSyntheticExport({
      managerReview: {
        reviewedBy: "Test Manager",
        reviewedAt: "2026-05-19T13:00:00.000Z",
        reviewNotes: "Inspected, photographs match field map.",
      },
    });
    const { blob } = renderApplicationRecordPdf(payload);
    const text = await blobAsLatin1(blob);
    expect(text).toContain("Inspected, photographs match field map.");
  });

  it("renders each event type and actor in the status history", async () => {
    const payload = buildSyntheticExport({
      events: [
        {
          id: "e1",
          type: "created",
          actorUserId: "u1",
          actorDisplayName: "Jane Applicator",
          occurredAt: "2026-05-19T11:00:00.000Z",
        },
        {
          id: "e2",
          type: "submitted",
          actorUserId: "u1",
          actorDisplayName: "Jane Applicator",
          occurredAt: "2026-05-19T11:30:00.000Z",
        },
        {
          id: "e3",
          type: "locked",
          actorUserId: "u2",
          actorDisplayName: "Test Manager",
          occurredAt: "2026-05-19T13:00:00.000Z",
        },
      ],
    });
    const { blob } = renderApplicationRecordPdf(payload);
    const text = await blobAsLatin1(blob);
    expect(text).toContain("created");
    expect(text).toContain("submitted");
    expect(text).toContain("locked");
    expect(text).toContain("Jane Applicator");
    expect(text).toContain("Test Manager");
  });

  it("paginates when the event log exceeds a single page", async () => {
    const events = Array.from({ length: 120 }, (_, i) => ({
      id: `e-${i}`,
      type: "submitted" as const,
      actorUserId: "u1",
      actorDisplayName: "Jane Applicator",
      occurredAt: `2026-05-19T${String(i % 24).padStart(2, "0")}:00:00.000Z`,
      message: `Synthetic event ${i}`,
    }));
    const payload = buildSyntheticExport({ events });
    const { blob } = renderApplicationRecordPdf(payload);
    const text = await blobAsLatin1(blob);
    const pageCount = (text.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
    expect(text).toContain("Synthetic event 0");
    expect(text).toContain("Synthetic event 119");
  });

  it("embeds the record id inside the PDF byte stream", async () => {
    const payload = buildSyntheticExport({
      recordId: "rec-needle-in-haystack",
    });
    const { blob } = renderApplicationRecordPdf(payload);
    const text = await blobAsLatin1(blob);
    expect(text).toContain("rec-needle-in-haystack");
  });
});
