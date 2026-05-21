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

  it("auto-flushes queued records to synced when online (opt-in via autoFlush)", async () => {
    const submitted = await seedQueuedRecord();
    expect((await db.applicationRecords.get(submitted.id))?.syncStatus).toBe("queued");

    // Auto-flush is opt-in (default off) so the global mount in AppHeader does
    // not silently sync. This test verifies the auto-flush path still works
    // when explicitly enabled.
    render(
      <SyncControls transport={createLoopbackTransport()} autoFlush />
    );

    await waitFor(async () => {
      const after = await db.applicationRecords.get(submitted.id);
      expect(after?.syncStatus).toBe("synced");
    });
  });

  it("does NOT auto-flush queued records when mounted with default props (regression: global SyncControls mount must not silently sync)", async () => {
    const submitted = await seedQueuedRecord();
    expect((await db.applicationRecords.get(submitted.id))?.syncStatus).toBe(
      "queued"
    );

    render(<SyncControls transport={createLoopbackTransport()} />);

    // Wait long enough that auto-flush would have fired if it were enabled.
    await new Promise((r) => setTimeout(r, 50));

    const after = await db.applicationRecords.get(submitted.id);
    expect(after?.syncStatus).toBe("queued");
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
