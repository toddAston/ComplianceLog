import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "./applicationRecordService";
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

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

describe("createDraftApplicationRecord", () => {
  it("creates a record with workflowStatus 'draft' and syncStatus 'local_only'", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );

    expect(draft.workflowStatus).toBe("draft");
    expect(draft.syncStatus).toBe("local_only");
  });

  it("appends exactly one 'created' event for the new record", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(draft.id)
      .toArray();

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("created");
    expect(events[0].actorUserId).toBe(TEST_APPLICATOR.userId);
    expect(events[0].actorDisplayName).toBe(TEST_APPLICATOR.displayName);
  });

  it("sets complianceReviewRequired=true when rupStatus is 'unknown'", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({ rupStatus: "unknown" }),
      },
      TEST_APPLICATOR
    );

    expect(draft.complianceReviewRequired).toBe(true);
  });
});

describe("submitApplicationRecord", () => {
  it("throws when attestationConfirmed is false", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({ attestationConfirmed: false }),
      },
      TEST_APPLICATOR
    );

    await expect(
      submitApplicationRecord(draft.id, TEST_APPLICATOR)
    ).rejects.toThrow(/attestation/i);
  });

  it("throws when record is not in draft state (no double-submit)", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );
    await submitApplicationRecord(draft.id, TEST_APPLICATOR);

    await expect(
      submitApplicationRecord(draft.id, TEST_APPLICATOR)
    ).rejects.toThrow(/draft/i);
  });

  it("transitions to pending_review, freezes a ProductSnapshot, and appends submit + snapshot events", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );

    const submitted = await submitApplicationRecord(draft.id, TEST_APPLICATOR);

    expect(submitted.workflowStatus).toBe("pending_review");
    expect(submitted.syncStatus).toBe("queued");
    expect(submitted.productSnapshotId).toBeDefined();
    expect(submitted.contractorInputs.submittedBy).toBe(
      TEST_APPLICATOR.displayName
    );

    const snapshot = await db.productSnapshots.get(submitted.productSnapshotId!);
    expect(snapshot).toBeDefined();
    expect(snapshot!.productName).toBe("Example Herbicide 4L");
    expect(snapshot!.epaRegistrationNumber).toBe("12345-678");
    expect(snapshot!.rupStatus).toBe("no");
    expect(snapshot!.catalogVersion).toBe("MO-DEMO-2026-05-19");
    expect(snapshot!.applicationRecordId).toBe(draft.id);

    const eventTypes = (
      await db.recordEvents
        .where("applicationRecordId")
        .equals(draft.id)
        .toArray()
    ).map((e) => e.type);

    expect(eventTypes).toContain("submitted");
    expect(eventTypes).toContain("product_snapshot_created");
  });

  it("ProductSnapshot does not drift when the source Product is later mutated", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );
    const submitted = await submitApplicationRecord(draft.id, TEST_APPLICATOR);
    const snapshotBefore = await db.productSnapshots.get(
      submitted.productSnapshotId!
    );

    await db.products.update("product-example-herbicide-4l", {
      name: "Example Herbicide 4L (renamed)",
      epaRegistrationNumber: "99999-999",
      catalogVersion: "MO-DEMO-2027-01-01",
    });

    const snapshotAfter = await db.productSnapshots.get(
      submitted.productSnapshotId!
    );
    expect(snapshotAfter).toEqual(snapshotBefore);
  });
});

describe("acceptAndLockApplicationRecord", () => {
  it("throws when record is not in pending_review state", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );

    await expect(
      acceptAndLockApplicationRecord(draft.id, TEST_MANAGER)
    ).rejects.toThrow(/pending review/i);
  });

  it("locks the record, sets lockedAt, appends reviewed + locked events, and leaves contractorInputs unchanged", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );
    const submitted = await submitApplicationRecord(draft.id, TEST_APPLICATOR);
    const contractorInputsBeforeLock = submitted.contractorInputs;

    const locked = await acceptAndLockApplicationRecord(
      draft.id,
      TEST_MANAGER,
      "Looks good."
    );

    expect(locked.workflowStatus).toBe("locked");
    expect(locked.system.lockedAt).toBeDefined();
    expect(locked.contractorInputs).toEqual(contractorInputsBeforeLock);
    expect(locked.managerInputs.reviewedBy).toBe(TEST_MANAGER.displayName);

    const eventTypes = (
      await db.recordEvents
        .where("applicationRecordId")
        .equals(draft.id)
        .toArray()
    ).map((e) => e.type);

    expect(eventTypes).toContain("reviewed");
    expect(eventTypes).toContain("locked");
  });
});
