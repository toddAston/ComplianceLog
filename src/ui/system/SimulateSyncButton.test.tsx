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
import type { ContractorInputs } from "../../domain/types";
import { SimulateSyncButton } from "./SimulateSyncButton";
import { SessionProvider } from "../session/SessionContext";

const APPLICATOR: ActorContext = {
  userId: "user-test-applicator",
  displayName: "Test Applicator",
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
  targetPest: "Waterhemp",
  temperature: "72F",
  windSpeed: "5 mph",
  windDirection: "S",
  attestationConfirmed: true,
  ...overrides,
});

async function seedQueuedRecord() {
  const draft = await createDraftApplicationRecord(
    { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
    APPLICATOR
  );
  return submitApplicationRecord(draft.id, APPLICATOR);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => cleanup());

describe("SimulateSyncButton", () => {
  it("renders the button in dev builds", () => {
    render(
      <SessionProvider initialRole="manager">
        <SimulateSyncButton />
      </SessionProvider>
    );
    expect(screen.getByTestId("simulate-sync-button")).toBeTruthy();
  });

  it("flips queued records to synced and reports the count", async () => {
    const user = userEvent.setup();
    const r1 = await seedQueuedRecord();
    const r2 = await seedQueuedRecord();
    // sanity: both queued
    expect((await db.applicationRecords.get(r1.id))!.syncStatus).toBe("queued");
    expect((await db.applicationRecords.get(r2.id))!.syncStatus).toBe("queued");

    render(
      <SessionProvider initialRole="manager">
        <SimulateSyncButton />
      </SessionProvider>
    );

    await user.click(screen.getByTestId("simulate-sync-button"));

    await waitFor(async () => {
      const a = await db.applicationRecords.get(r1.id);
      const b = await db.applicationRecords.get(r2.id);
      expect(a?.syncStatus).toBe("synced");
      expect(b?.syncStatus).toBe("synced");
    });
    expect(
      screen.getByTestId("simulate-sync-result").textContent
    ).toMatch(/Synced 2 records/);
  });

  it("reports nothing-queued when no records are queued", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider initialRole="manager">
        <SimulateSyncButton />
      </SessionProvider>
    );
    await user.click(screen.getByTestId("simulate-sync-button"));
    await waitFor(() => {
      expect(
        screen.getByTestId("simulate-sync-result").textContent
      ).toMatch(/Nothing queued/);
    });
  });

  it("uses the session actor as the actor on the appended sync event", async () => {
    const user = userEvent.setup();
    const submitted = await seedQueuedRecord();
    render(
      <SessionProvider initialRole="manager">
        <SimulateSyncButton />
      </SessionProvider>
    );
    await user.click(screen.getByTestId("simulate-sync-button"));

    await waitFor(async () => {
      const a = await db.applicationRecords.get(submitted.id);
      expect(a?.syncStatus).toBe("synced");
    });
    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(submitted.id)
      .toArray();
    const syncEvent = events.find(
      (e) => e.message === "Sync simulated: queued → synced."
    );
    expect(syncEvent).toBeDefined();
    expect(syncEvent!.actorDisplayName).toBe("Demo Manager");
    expect((syncEvent!.metadata as any).syncStatusAfter).toBe("synced");
  });
});
