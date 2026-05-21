import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  requestCorrectionForApplicationRecord,
  resubmitCorrectedApplicationRecord,
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

  it("blocks approval of a record with unresolved warnings when no review note is given (matrix #78)", async () => {
    // A long-past application date trips RECORD_LATE (a warning) without any
    // blocking required-field failures.
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({ applicationDate: "2026-01-05" }),
      },
      TEST_APPLICATOR
    );
    await submitApplicationRecord(draft.id, TEST_APPLICATOR);

    await expect(
      acceptAndLockApplicationRecord(draft.id, TEST_MANAGER)
    ).rejects.toThrow(/unresolved warnings/i);
  });

  it("allows approval of a record with warnings when a review note documents the override (matrix #78)", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({ applicationDate: "2026-01-05" }),
      },
      TEST_APPLICATOR
    );
    await submitApplicationRecord(draft.id, TEST_APPLICATOR);

    const locked = await acceptAndLockApplicationRecord(
      draft.id,
      TEST_MANAGER,
      "Late entry: field notes were transcribed after the fact."
    );

    expect(locked.workflowStatus).toBe("locked");
    expect(locked.managerInputs.reviewNotes).toMatch(/late entry/i);
  });

  it("does not require a review note when the record has no warnings", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );
    await submitApplicationRecord(draft.id, TEST_APPLICATOR);

    const locked = await acceptAndLockApplicationRecord(draft.id, TEST_MANAGER);
    expect(locked.workflowStatus).toBe("locked");
  });
});

describe("requestCorrectionForApplicationRecord", () => {
  async function seedPendingReview() {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );
    return submitApplicationRecord(draft.id, TEST_APPLICATOR);
  }

  it("rejects correction requests on draft records", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );

    await expect(
      requestCorrectionForApplicationRecord(draft.id, TEST_MANAGER, "Fix x.")
    ).rejects.toThrow(/pending review/i);
  });

  it("rejects correction requests on locked records", async () => {
    const submitted = await seedPendingReview();
    await acceptAndLockApplicationRecord(submitted.id, TEST_MANAGER);

    await expect(
      requestCorrectionForApplicationRecord(
        submitted.id,
        TEST_MANAGER,
        "Fix x."
      )
    ).rejects.toThrow(/pending review/i);
  });

  it("rejects correction requests on records already in needs_correction", async () => {
    const submitted = await seedPendingReview();
    await requestCorrectionForApplicationRecord(
      submitted.id,
      TEST_MANAGER,
      "Fix x."
    );

    await expect(
      requestCorrectionForApplicationRecord(
        submitted.id,
        TEST_MANAGER,
        "Fix y."
      )
    ).rejects.toThrow(/pending review/i);
  });

  it("rejects unknown record ids", async () => {
    await expect(
      requestCorrectionForApplicationRecord(
        "does-not-exist",
        TEST_MANAGER,
        "Fix x."
      )
    ).rejects.toThrow(/not found/i);
  });

  it("rejects empty or whitespace-only correction notes", async () => {
    const submitted = await seedPendingReview();

    await expect(
      requestCorrectionForApplicationRecord(submitted.id, TEST_MANAGER, "")
    ).rejects.toThrow(/correction notes/i);

    await expect(
      requestCorrectionForApplicationRecord(submitted.id, TEST_MANAGER, "   ")
    ).rejects.toThrow(/correction notes/i);

    const stillPending = await db.applicationRecords.get(submitted.id);
    expect(stillPending?.workflowStatus).toBe("pending_review");
  });

  it("transitions pending_review to needs_correction and records manager review", async () => {
    const submitted = await seedPendingReview();

    const updated = await requestCorrectionForApplicationRecord(
      submitted.id,
      TEST_MANAGER,
      "Acres treated looks wrong."
    );

    expect(updated.workflowStatus).toBe("needs_correction");
    expect(updated.managerInputs.reviewStatus).toBe("needs_correction");
    expect(updated.managerInputs.reviewedBy).toBe(TEST_MANAGER.displayName);
    expect(updated.managerInputs.reviewedAt).toBeDefined();
    expect(updated.managerInputs.reviewNotes).toBe(
      "Acres treated looks wrong."
    );
  });

  it("appends one correction_requested event with manager actor identity and notes metadata", async () => {
    const submitted = await seedPendingReview();
    const eventsBefore = await db.recordEvents
      .where("applicationRecordId")
      .equals(submitted.id)
      .toArray();

    await requestCorrectionForApplicationRecord(
      submitted.id,
      TEST_MANAGER,
      "Acres treated looks wrong."
    );

    const eventsAfter = await db.recordEvents
      .where("applicationRecordId")
      .equals(submitted.id)
      .toArray();

    expect(eventsAfter).toHaveLength(eventsBefore.length + 1);

    const correction = eventsAfter.find((e) => e.type === "correction_requested");
    expect(correction).toBeDefined();
    expect(correction!.actorUserId).toBe(TEST_MANAGER.userId);
    expect(correction!.actorDisplayName).toBe(TEST_MANAGER.displayName);
    expect(correction!.metadata?.correctionNotes).toBe(
      "Acres treated looks wrong."
    );
  });

  it("does not mutate contractorInputs", async () => {
    const submitted = await seedPendingReview();
    const before = submitted.contractorInputs;

    await requestCorrectionForApplicationRecord(
      submitted.id,
      TEST_MANAGER,
      "Fix x."
    );

    const after = (await db.applicationRecords.get(submitted.id))!
      .contractorInputs;
    expect(after).toEqual(before);
  });

  it("does not mutate the ProductSnapshot row referenced by the record", async () => {
    const submitted = await seedPendingReview();
    const snapshotBefore = await db.productSnapshots.get(
      submitted.productSnapshotId!
    );

    await requestCorrectionForApplicationRecord(
      submitted.id,
      TEST_MANAGER,
      "Fix x."
    );

    const snapshotAfter = await db.productSnapshots.get(
      submitted.productSnapshotId!
    );
    expect(snapshotAfter).toEqual(snapshotBefore);
  });

  it("preserves existing submitted and product_snapshot_created events", async () => {
    const submitted = await seedPendingReview();
    const submittedEventsBefore = (
      await db.recordEvents
        .where("applicationRecordId")
        .equals(submitted.id)
        .toArray()
    ).filter(
      (e) => e.type === "submitted" || e.type === "product_snapshot_created"
    );

    await requestCorrectionForApplicationRecord(
      submitted.id,
      TEST_MANAGER,
      "Fix x."
    );

    const submittedEventsAfter = (
      await db.recordEvents
        .where("applicationRecordId")
        .equals(submitted.id)
        .toArray()
    ).filter(
      (e) => e.type === "submitted" || e.type === "product_snapshot_created"
    );

    expect(submittedEventsAfter).toEqual(submittedEventsBefore);
  });
});

describe("submitApplicationRecord — compliance integration", () => {
  it("blocks submit when RUP product used by uncertified applicator", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({
          rupStatus: "yes",
          certificationNumber: "",
        }),
      },
      TEST_APPLICATOR
    );

    await expect(
      submitApplicationRecord(draft.id, TEST_APPLICATOR)
    ).rejects.toThrow(/restricted-use product/i);

    const record = await db.applicationRecords.get(draft.id);
    expect(record!.workflowStatus).toBe("draft");
  });

  it("allows submit with warnings and stores compliance_check_run event", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({
          windDirection: "",
        }),
      },
      TEST_APPLICATOR
    );

    const submitted = await submitApplicationRecord(draft.id, TEST_APPLICATOR);
    expect(submitted.workflowStatus).toBe("pending_review");

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(draft.id)
      .toArray();

    const checkEvent = events.find((e) => e.type === "compliance_check_run");
    expect(checkEvent).toBeDefined();
    expect((checkEvent!.metadata as any).results.length).toBeGreaterThan(0);
    const outcomes = (checkEvent!.metadata as any).outcomes as Array<{
      ruleId: string;
      status: "pass" | "fail" | "unknown";
      description: string;
    }>;
    expect(outcomes).toBeDefined();
    // Total rule count grows with each phased compliance addition; assert lower
    // bound rather than exact match so the test survives matrix expansion.
    expect(outcomes.length).toBeGreaterThanOrEqual(25);
    expect(outcomes.every((o) => typeof o.status === "string")).toBe(true);
    expect(outcomes.some((o) => o.status === "fail")).toBe(true);
    expect(outcomes.some((o) => o.status === "pass")).toBe(true);
    expect((checkEvent!.metadata as any).phase).toBe("submit");
    expect(checkEvent!.message).toMatch(/\d+ pass, \d+ fail, \d+ unknown/);
  });
});

describe("resubmitCorrectedApplicationRecord", () => {
  async function createNeedsCorrectionRecord() {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({ windDirection: "" }),
      },
      TEST_APPLICATOR
    );
    await submitApplicationRecord(draft.id, TEST_APPLICATOR);
    await requestCorrectionForApplicationRecord(
      draft.id,
      TEST_MANAGER,
      "Please add wind direction."
    );
    return draft.id;
  }

  it("rejects non-needs_correction records", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );

    await expect(
      resubmitCorrectedApplicationRecord(
        draft.id,
        { windDirection: "S" },
        TEST_APPLICATOR
      )
    ).rejects.toThrow(/only records needing correction/i);
  });

  it("rejects empty updated fields", async () => {
    const recordId = await createNeedsCorrectionRecord();

    await expect(
      resubmitCorrectedApplicationRecord(recordId, {}, TEST_APPLICATOR)
    ).rejects.toThrow(/at least one field/i);
  });

  it("transitions needs_correction to pending_review", async () => {
    const recordId = await createNeedsCorrectionRecord();

    const updated = await resubmitCorrectedApplicationRecord(
      recordId,
      { windDirection: "SSW" },
      TEST_APPLICATOR
    );

    expect(updated.workflowStatus).toBe("pending_review");
    expect(updated.contractorInputs.windDirection).toBe("SSW");
  });

  it("resets manager inputs", async () => {
    const recordId = await createNeedsCorrectionRecord();

    const updated = await resubmitCorrectedApplicationRecord(
      recordId,
      { windDirection: "SSW" },
      TEST_APPLICATOR
    );

    expect(updated.managerInputs.reviewStatus).toBe("not_reviewed");
    expect(updated.managerInputs.reviewedBy).toBeUndefined();
  });

  it("appends correction_submitted event with diff", async () => {
    const recordId = await createNeedsCorrectionRecord();

    await resubmitCorrectedApplicationRecord(
      recordId,
      { windDirection: "SSW" },
      TEST_APPLICATOR
    );

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(recordId)
      .toArray();

    const corrEvt = events.find((e) => e.type === "correction_submitted");
    expect(corrEvt).toBeDefined();
    expect((corrEvt!.metadata as any).updatedFields).toEqual({
      windDirection: "SSW",
    });
  });

  it("appends compliance_check_run event on resubmit", async () => {
    const recordId = await createNeedsCorrectionRecord();

    await resubmitCorrectedApplicationRecord(
      recordId,
      { windDirection: "SSW" },
      TEST_APPLICATOR
    );

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(recordId)
      .toArray();

    const checkEvents = events.filter(
      (e) => e.type === "compliance_check_run"
    );
    expect(checkEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("blocks resubmit when blocked rules fire", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({
          rupStatus: "no",
          certificationNumber: "",
        }),
      },
      TEST_APPLICATOR
    );
    await submitApplicationRecord(draft.id, TEST_APPLICATOR);
    await requestCorrectionForApplicationRecord(
      draft.id,
      TEST_MANAGER,
      "Fix something"
    );

    await expect(
      resubmitCorrectedApplicationRecord(
        draft.id,
        { rupStatus: "yes" },
        TEST_APPLICATOR
      )
    ).rejects.toThrow(/restricted-use product/i);
  });
});
