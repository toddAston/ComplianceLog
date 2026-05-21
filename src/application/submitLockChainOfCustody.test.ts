import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import { DEMO_ORG_ID, seedDemoData } from "../db/seed";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "./applicationRecordService";
import { createLoopbackTransport } from "./sync/loopbackTransport";
import { flushOutbox } from "./sync/syncService";
import { runAllComplianceChecks } from "./complianceRules";
import { buildContractorInputs } from "./sync/syncTestFixtures";

// Regression test for the chain-of-custody bug the manager hit at lock time
// after the SyncControls auto-flush regression was fixed:
//
//   "Cannot approve: required record fields are missing or fail an explicit
//    rule (FIELDLOG_CHAIN_OF_CUSTODY). Submitter identity is missing from
//    this submitted record (chain-of-custody integrity)."
//
// Root cause was in two places working together:
//   1. The local submit service stamped contractorInputs.submittedBy =
//      actor.displayName, BUT
//   2. The loopback transport's "submit" handler returned a record that did
//      NOT carry submittedBy (the op had no payload), and
//   3. syncService.flushOutbox calls adoptServerRecord which fully replaces
//      the local record with the server response — wiping the locally-set
//      submittedBy.
//
// Fix: pass `submittedBy` in the submit op's payload; have the loopback
// transport persist it; verify the post-sync record still has it and the
// chain-of-custody rule passes.

const APPLICATOR: ActorContext = {
  userId: "user-demo-applicator",
  displayName: "Demo Applicator",
};
const MANAGER: ActorContext = {
  userId: "user-demo-manager",
  displayName: "Demo Manager",
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

describe("submit → sync → lock end-to-end preserves submitter identity", () => {
  it("after sync, the submitted record still carries submittedBy from the local actor", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      APPLICATOR
    );
    const submitted = await submitApplicationRecord(draft.id, APPLICATOR);
    expect(submitted.contractorInputs.submittedBy).toBe(APPLICATOR.displayName);

    // Run the same flush path the SyncControls "Sync now" button drives.
    const transport = createLoopbackTransport();
    const result = await flushOutbox(transport);
    expect(result.applied).toBeGreaterThan(0);

    const afterSync = await db.applicationRecords.get(draft.id);
    expect(afterSync?.syncStatus).toBe("synced");
    // The key assertion: sync must not wipe the submitter identity.
    expect(afterSync?.contractorInputs.submittedBy).toBe(APPLICATOR.displayName);
    expect(afterSync?.contractorInputs.submittedAt).toBeDefined();
  });

  it("MISSING_SUBMITTER_IDENTITY does not fire on a freshly-synced submitted record", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      APPLICATOR
    );
    await submitApplicationRecord(draft.id, APPLICATOR);
    await flushOutbox(createLoopbackTransport());

    const after = await db.applicationRecords.get(draft.id);
    expect(after).toBeDefined();
    const outcomes = runAllComplianceChecks(after!);
    const submitterRule = outcomes.find(
      (o) => o.ruleId === "MISSING_SUBMITTER_IDENTITY"
    );
    expect(submitterRule).toBeDefined();
    expect(submitterRule!.status).toBe("pass");
  });

  it("MISSING_SUBMISSION_TIMESTAMP does not fire on a freshly-synced submitted record", async () => {
    const draft = await createDraftApplicationRecord(
      { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
      APPLICATOR
    );
    await submitApplicationRecord(draft.id, APPLICATOR);
    await flushOutbox(createLoopbackTransport());

    const after = await db.applicationRecords.get(draft.id);
    const outcomes = runAllComplianceChecks(after!);
    const tsRule = outcomes.find(
      (o) => o.ruleId === "MISSING_SUBMISSION_TIMESTAMP"
    );
    expect(tsRule?.status).toBe("pass");
  });

  it("manager Lock succeeds against a sync-applied record (regression: no chain-of-custody error)", async () => {
    // Fill endTime so MISSING_END_TIME doesn't block lock (Phase 1 made End
    // Time required at error severity). Fixture default omits it.
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({ endTime: "11:30" }),
      },
      APPLICATOR
    );
    await submitApplicationRecord(draft.id, APPLICATOR);
    await flushOutbox(createLoopbackTransport());

    // Before the fix: this throws
    //   "Cannot approve: required record fields are missing or fail an
    //    explicit rule (FIELDLOG_CHAIN_OF_CUSTODY)..."
    // After the fix: this succeeds.
    const locked = await acceptAndLockApplicationRecord(
      draft.id,
      MANAGER,
      "Looks good — reviewed in tests."
    );

    expect(locked.workflowStatus).toBe("locked");
    expect(locked.contractorInputs.submittedBy).toBe(APPLICATOR.displayName);
    expect(locked.managerInputs.reviewedBy).toBe(MANAGER.displayName);
  });
});
