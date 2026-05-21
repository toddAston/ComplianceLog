import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "./applicationRecordService";
import {
  AUDIT_EXPORT_DISCLAIMER,
  exportLockedApplicationRecord,
} from "./applicationRecordExport";
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
  endTime: "11:30",
  applicationMethod: "Ground broadcast",
  rateApplied: "1 qt/ac",
  totalAmountApplied: "10 gal",
  targetPest: "Waterhemp",

  temperature: "72F",
  windSpeed: "5 mph",
  windDirection: "S",

  attestationConfirmed: true,

  // Backfill P0 compliance-matrix fields so the "fully compliant" baseline
  // record continues to satisfy the new required-field rules.
  requesterName: "Acme Producer Co.",
  requesterAddress: "1234 Main St, Columbia, MO 65201",
  siteDescription: "North 40, soybean field along Highway B",

  applicatorCategory: "certified_commercial",
  slnNumber: "",

  ...overrides,
});

async function seedDraft() {
  return createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(),
    },
    TEST_APPLICATOR
  );
}

async function seedLockedRecord(reviewNotes?: string) {
  const draft = await seedDraft();
  await submitApplicationRecord(draft.id, TEST_APPLICATOR);
  return acceptAndLockApplicationRecord(draft.id, TEST_MANAGER, reviewNotes);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

describe("exportLockedApplicationRecord", () => {
  it("returns a stable DTO for a locked record with all required fields populated", async () => {
    const locked = await seedLockedRecord("Looks good.");

    const dto = await exportLockedApplicationRecord(locked.id);

    expect(dto.exportSchemaVersion).toBe("v1");
    expect(dto.recordId).toBe(locked.id);
    expect(dto.organizationId).toBe(DEMO_ORG_ID);
    expect(dto.workflowStatus).toBe("locked");

    expect(dto.contractorInputs.applicatorName).toBe("John Smith");
    expect(dto.contractorInputs.farmName).toBe("North Farm");
    expect(dto.contractorInputs.fieldName).toBe("Field 7");
    expect(dto.contractorInputs.productName).toBe("Example Herbicide 4L");
    expect(dto.contractorInputs.epaRegistrationNumber).toBe("12345-678");
    expect(dto.contractorInputs.submittedBy).toBe(TEST_APPLICATOR.displayName);
    expect(dto.contractorInputs.submittedAt).toBeDefined();

    expect(dto.productSnapshot.epaRegistrationNumber).toBe("12345-678");
    expect(dto.productSnapshot.catalogVersion).toBe("MO-DEMO-2026-05-19");
    expect(dto.productSnapshot.applicationRecordId).toBe(locked.id);

    expect(dto.managerReview.reviewedBy).toBe(TEST_MANAGER.displayName);
    expect(dto.managerReview.reviewedAt).toBeDefined();
    expect(dto.managerReview.reviewNotes).toBe("Looks good.");

    expect(dto.system.lockedAt).toBeDefined();
    expect(dto.system.createdAt).toBeDefined();
    expect(dto.system.createdOffline).toBe(true);
  });

  it("rejects unknown record ids", async () => {
    await expect(
      exportLockedApplicationRecord("does-not-exist")
    ).rejects.toThrow(/not found/i);
  });

  it("rejects draft records", async () => {
    const draft = await seedDraft();
    await expect(
      exportLockedApplicationRecord(draft.id)
    ).rejects.toThrow(/locked/i);
  });

  it("rejects pending_review records", async () => {
    const draft = await seedDraft();
    await submitApplicationRecord(draft.id, TEST_APPLICATOR);
    await expect(
      exportLockedApplicationRecord(draft.id)
    ).rejects.toThrow(/locked/i);
  });

  it("does not mutate the source record, snapshot, or events", async () => {
    const locked = await seedLockedRecord("Looks good.");

    const recordBefore = await db.applicationRecords.get(locked.id);
    const snapshotBefore = await db.productSnapshots.get(
      locked.productSnapshotId!
    );
    const eventsBefore = await db.recordEvents
      .where("applicationRecordId")
      .equals(locked.id)
      .toArray();

    await exportLockedApplicationRecord(locked.id);

    const recordAfter = await db.applicationRecords.get(locked.id);
    const snapshotAfter = await db.productSnapshots.get(
      locked.productSnapshotId!
    );
    const eventsAfter = await db.recordEvents
      .where("applicationRecordId")
      .equals(locked.id)
      .toArray();

    expect(recordAfter).toEqual(recordBefore);
    expect(snapshotAfter).toEqual(snapshotBefore);
    expect(eventsAfter).toEqual(eventsBefore);
  });

  it("includes chain-of-custody event types with actor attribution", async () => {
    const locked = await seedLockedRecord();

    const dto = await exportLockedApplicationRecord(locked.id);

    const types = dto.events.map((e) => e.type);
    expect(types).toContain("created");
    expect(types).toContain("submitted");
    expect(types).toContain("product_snapshot_created");
    expect(types).toContain("reviewed");
    expect(types).toContain("locked");

    const submitted = dto.events.find((e) => e.type === "submitted");
    expect(submitted?.actorUserId).toBe(TEST_APPLICATOR.userId);
    expect(submitted?.actorDisplayName).toBe(TEST_APPLICATOR.displayName);
    expect(submitted?.occurredAt).toBeDefined();

    const lockedEvent = dto.events.find((e) => e.type === "locked");
    expect(lockedEvent?.actorUserId).toBe(TEST_MANAGER.userId);
    expect(lockedEvent?.actorDisplayName).toBe(TEST_MANAGER.displayName);
    expect(lockedEvent?.occurredAt).toBeDefined();
  });

  it("returns deep-equal output across repeated calls (reproducible)", async () => {
    const locked = await seedLockedRecord("Looks good.");

    const a = await exportLockedApplicationRecord(locked.id);
    const b = await exportLockedApplicationRecord(locked.id);

    expect(a).toEqual(b);
  });

  it("orders events deterministically by occurredAt then id", async () => {
    const locked = await seedLockedRecord();

    const dto = await exportLockedApplicationRecord(locked.id);

    for (let i = 1; i < dto.events.length; i++) {
      const prev = dto.events[i - 1];
      const curr = dto.events[i];
      const prevKey = `${prev.occurredAt}|${prev.id}`;
      const currKey = `${curr.occurredAt}|${curr.id}`;
      expect(prevKey <= currKey).toBe(true);
    }
  });

  it("omits reviewNotes when not provided at lock time", async () => {
    const locked = await seedLockedRecord();

    const dto = await exportLockedApplicationRecord(locked.id);

    expect(dto.managerReview.reviewedBy).toBe(TEST_MANAGER.displayName);
    expect(dto.managerReview.reviewNotes).toBeUndefined();
  });

  it("derives retainUntil as application date plus three years (matrix #6)", async () => {
    const locked = await seedLockedRecord("Looks good.");
    const dto = await exportLockedApplicationRecord(locked.id);
    expect(dto.retainUntil).toBe("2029-05-19");
  });

  it("embeds a source-linked compliance checklist (matrix #81)", async () => {
    const locked = await seedLockedRecord("Looks good.");
    const dto = await exportLockedApplicationRecord(locked.id);

    expect(dto.complianceChecklist.length).toBeGreaterThan(0);
    for (const item of dto.complianceChecklist) {
      expect(item.citationShort.length).toBeGreaterThan(0);
      expect(item.ruleId.length).toBeGreaterThan(0);
      expect(["pass", "fail", "unknown"]).toContain(item.status);
    }
    // The seeded record is fully populated → no failures.
    expect(dto.complianceChecklist.every((c) => c.status !== "fail")).toBe(true);
  });

  it("includes the recordkeeping-vs-regulatory-review disclaimer (matrix #82)", async () => {
    const locked = await seedLockedRecord("Looks good.");
    const dto = await exportLockedApplicationRecord(locked.id);
    expect(dto.disclaimer).toBe(AUDIT_EXPORT_DISCLAIMER);
    expect(dto.disclaimer).toMatch(/qualified human review/i);
  });

  it("blocks export when the event timeline is empty (matrix #79/#81)", async () => {
    const locked = await seedLockedRecord("Looks good.");
    await db.recordEvents.where("applicationRecordId").equals(locked.id).delete();
    await expect(
      exportLockedApplicationRecord(locked.id)
    ).rejects.toThrow(/event timeline/i);
  });
});
