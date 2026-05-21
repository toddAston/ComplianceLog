import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./fieldlogDb";
import { DEMO_ORG_ID, seedDemoData } from "./seed";
import {
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "../application/applicationRecordService";
import { buildContractorInputs } from "../application/sync/syncTestFixtures";
import { backfillSubmitterIdentity } from "./backfillSubmitterIdentity";

const APPLICATOR: ActorContext = {
  userId: "user-demo-applicator",
  displayName: "Demo Applicator",
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

describe("backfillSubmitterIdentity boot heal", () => {
  it("backfills submittedBy and submittedAt from the submitted event when contractorInputs are missing them", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      APPLICATOR
    );
    await submitApplicationRecord(draft.id, APPLICATOR);

    // Simulate the bad-state scenario: a prior sync writeback cleared the
    // submitter stamps but the `submitted` event is still in place.
    await db.applicationRecords.update(draft.id, {
      contractorInputs: {
        ...(await db.applicationRecords.get(draft.id))!.contractorInputs,
        submittedBy: undefined,
        submittedAt: undefined,
      },
    });
    const broken = await db.applicationRecords.get(draft.id);
    expect(broken?.contractorInputs.submittedBy).toBeUndefined();

    const result = await backfillSubmitterIdentity();
    expect(result.healed).toBe(1);

    const healed = await db.applicationRecords.get(draft.id);
    expect(healed?.contractorInputs.submittedBy).toBe(APPLICATOR.displayName);
    expect(healed?.contractorInputs.submittedAt).toBeDefined();
  });

  it("is a no-op when every submitted record already has its stamps", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      APPLICATOR
    );
    await submitApplicationRecord(draft.id, APPLICATOR);

    const before = await db.applicationRecords.get(draft.id);
    const result = await backfillSubmitterIdentity();
    expect(result.healed).toBe(0);

    const after = await db.applicationRecords.get(draft.id);
    expect(after?.contractorInputs.submittedBy).toBe(
      before?.contractorInputs.submittedBy
    );
  });

  it("never touches draft records (no submission has occurred yet)", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      APPLICATOR
    );
    // Draft has no submittedBy by design — should NOT be healed.
    const result = await backfillSubmitterIdentity();
    expect(result.healed).toBe(0);

    const after = await db.applicationRecords.get(draft.id);
    expect(after?.contractorInputs.submittedBy).toBeUndefined();
  });

  it("is idempotent: a second run after a heal does nothing", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      APPLICATOR
    );
    await submitApplicationRecord(draft.id, APPLICATOR);
    await db.applicationRecords.update(draft.id, {
      contractorInputs: {
        ...(await db.applicationRecords.get(draft.id))!.contractorInputs,
        submittedBy: undefined,
      },
    });

    await backfillSubmitterIdentity();
    const second = await backfillSubmitterIdentity();
    expect(second.healed).toBe(0);
  });
});
