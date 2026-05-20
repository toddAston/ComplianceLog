import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../../db/fieldlogDb";
import { seedDemoData, DEMO_ORG_ID } from "../../db/seed";
import {
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import { createLoopbackTransport } from "../../application/sync/loopbackTransport";
import { buildContractorInputs } from "../../application/sync/syncTestFixtures";
import { SyncControls } from "./SyncControls";

const ACTOR: ActorContext = {
  userId: "user-demo-applicator",
  displayName: "Demo Applicator",
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => cleanup());

async function seedQueuedRecord() {
  const draft = await createDraftApplicationRecord(
    { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
    ACTOR
  );
  return submitApplicationRecord(draft.id, ACTOR);
}

describe("SyncControls", () => {
  it("renders a Sync now button", () => {
    render(<SyncControls transport={createLoopbackTransport()} />);
    expect(screen.getByTestId("sync-now-button")).toBeTruthy();
  });

  it("auto-flushes queued records to synced when online", async () => {
    const submitted = await seedQueuedRecord();
    expect((await db.applicationRecords.get(submitted.id))?.syncStatus).toBe("queued");

    render(<SyncControls transport={createLoopbackTransport()} />);

    await waitFor(async () => {
      const after = await db.applicationRecords.get(submitted.id);
      expect(after?.syncStatus).toBe("synced");
    });
  });

  it("reports nothing-to-sync when the outbox is empty", async () => {
    const user = userEvent.setup();
    render(<SyncControls transport={createLoopbackTransport()} />);

    // Wait for the mount auto-flush to settle, then click with an empty outbox.
    await waitFor(() => expect(db.outbox.count()).resolves.toBe(0));
    await user.click(screen.getByTestId("sync-now-button"));

    await waitFor(() => {
      expect(screen.getByTestId("sync-result").textContent).toMatch(/Nothing to sync/);
    });
  });
});
