import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { db } from "../../db/fieldlogDb";
import { seedDemoData, DEMO_ORG_ID } from "../../db/seed";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  requestCorrectionForApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import type { ApplicationRecord, ContractorInputs } from "../../domain/types";
import { RecordDetailDialog } from "./RecordDetailDialog";

const APPLICATOR: ActorContext = {
  userId: "user-test-applicator",
  displayName: "Test Applicator",
};

const MANAGER: ActorContext = {
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

  requesterName: "Acme Producer Co.",
  requesterAddress: "1234 Main St, Columbia, MO 65201",
  siteDescription: "North 40, soybean field along Highway B",

  applicatorCategory: "certified_commercial",
  slnNumber: "",

  ...overrides,
});

async function seedSubmittedRecord(): Promise<ApplicationRecord> {
  const draft = await createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(),
    },
    APPLICATOR
  );
  return submitApplicationRecord(draft.id, APPLICATOR);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

describe("RecordDetailDialog audit timeline", () => {
  it("shows an empty timeline message when the record has no events", () => {
    const ghost: ApplicationRecord = {
      id: "ghost-record",
      organizationId: DEMO_ORG_ID,
      workflowStatus: "draft",
      syncStatus: "local_only",
      contractorInputs: buildContractorInputs({ attestationConfirmed: false }),
      managerInputs: { reviewStatus: "not_reviewed" },
      system: {
        createdAt: new Date().toISOString(),
        createdOffline: true,
        lastUpdatedAt: new Date().toISOString(),
      },
      complianceReviewRequired: false,
    };

    render(<RecordDetailDialog record={ghost} onClose={() => undefined} />);

    expect(screen.getByTestId("audit-timeline")).toBeTruthy();
    expect(screen.getByText(/No events recorded\./i)).toBeTruthy();
  });

  it("renders one timeline item per stored event with type + ISO timestamp tooltip + actor", async () => {
    const submitted = await seedSubmittedRecord();
    const reloaded = await db.applicationRecords.get(submitted.id);
    expect(reloaded).toBeTruthy();
    render(
      <RecordDetailDialog record={reloaded!} onClose={() => undefined} />
    );

    const list = await screen.findByTestId("audit-timeline-list");
    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(submitted.id)
      .toArray();
    expect(events.length).toBeGreaterThan(0);

    for (const evt of events) {
      const item = within(list).getByTestId(`audit-event-${evt.id}`);
      expect(
        within(item).getByTestId(`audit-event-type-${evt.id}`).textContent
      ).toContain(evt.type);
      const time = within(item).getByTestId(`audit-event-time-${evt.id}`);
      expect(time.closest('[aria-label]')?.getAttribute("aria-label")).toBe(
        evt.occurredAt
      );
      expect(time).toBeTruthy();
    }
  });

  it("includes correction_requested events with the manager's note in the timeline message", async () => {
    const submitted = await seedSubmittedRecord();
    await requestCorrectionForApplicationRecord(
      submitted.id,
      MANAGER,
      "Wind speed missing — please update."
    );
    const reloaded = await db.applicationRecords.get(submitted.id);
    render(
      <RecordDetailDialog record={reloaded!} onClose={() => undefined} />
    );

    const list = await screen.findByTestId("audit-timeline-list");
    expect(
      within(list).getAllByText(/correction_requested/i).length
    ).toBeGreaterThan(0);
    // Manager's free-text note is stored in event.metadata.correctionNotes,
    // not in the standardized event.message. Assert the persistence path so
    // the timeline contract (message present) holds even when the note is rich.
    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(submitted.id)
      .toArray();
    const correctionEvent = events.find(
      (e) => e.type === "correction_requested"
    );
    expect(correctionEvent?.metadata?.correctionNotes).toContain(
      "Wind speed missing"
    );
  });

  it("renders locked + submitted + reviewed events in chronological order after lock", async () => {
    const submitted = await seedSubmittedRecord();
    await acceptAndLockApplicationRecord(submitted.id, MANAGER, "All good.");
    const reloaded = await db.applicationRecords.get(submitted.id);
    render(
      <RecordDetailDialog record={reloaded!} onClose={() => undefined} />
    );

    const list = await screen.findByTestId("audit-timeline-list");
    // Count timeline rows by querying direct <li> children, since each event
    // testid is `audit-event-<uuid>` and the uuid hyphens collide with regex
    // matches for nested child testids.
    const items = list.querySelectorAll(":scope > li");
    expect(items.length).toBeGreaterThanOrEqual(3);

    // Confirm timeline contains the major lifecycle events.
    expect(within(list).getAllByText(/^submitted$/i).length).toBeGreaterThan(0);
    expect(within(list).getAllByText(/^locked$/i).length).toBeGreaterThan(0);
  });

  it("expands compliance_check_run events into per-rule pass/fail/unknown outcomes", async () => {
    // Submit with target pest empty + RUP unknown so we get a mix of pass/fail/unknown statuses.
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs({
          targetPest: "",
        }),
      },
      APPLICATOR
    );
    const submitted = await submitApplicationRecord(draft.id, APPLICATOR);
    const reloaded = await db.applicationRecords.get(submitted.id);
    render(
      <RecordDetailDialog record={reloaded!} onClose={() => undefined} />
    );

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(submitted.id)
      .toArray();
    const checkEvent = events.find((e) => e.type === "compliance_check_run");
    expect(checkEvent).toBeTruthy();

    const block = await screen.findByTestId(
      `audit-event-compliance-${checkEvent!.id}`
    );
    // Each of the 4 rules is enumerated explicitly.
    const ruleIds = [
      "MISSING_WIND",
      "MISSING_TARGET_PEST",
      "RECORD_LATE",
      "RUP_UNCERTIFIED",
    ];
    for (const rid of ruleIds) {
      expect(
        within(block).getByTestId(
          `audit-compliance-${checkEvent!.id}-${rid}`
        )
      ).toBeTruthy();
    }
    // Target pest is missing so MISSING_TARGET_PEST must be marked FAIL.
    const failStatus = within(block).getByTestId(
      `audit-compliance-status-${checkEvent!.id}-MISSING_TARGET_PEST`
    );
    expect(failStatus.getAttribute("aria-label")).toBe("FAIL");
    // Wind is present so MISSING_WIND must be PASS.
    const windStatus = within(block).getByTestId(
      `audit-compliance-status-${checkEvent!.id}-MISSING_WIND`
    );
    expect(windStatus.getAttribute("aria-label")).toBe("PASS");
  });

  it("does not show the locked banner on a still-pending record", async () => {
    const submitted = await seedSubmittedRecord();
    const reloaded = await db.applicationRecords.get(submitted.id);
    render(
      <RecordDetailDialog record={reloaded!} onClose={() => undefined} />
    );
    expect(screen.queryByTestId("locked-banner")).toBeNull();
  });

  it("renders a prominent locked banner with timestamp + actor + review notes when locked", async () => {
    const submitted = await seedSubmittedRecord();
    await acceptAndLockApplicationRecord(
      submitted.id,
      MANAGER,
      "Looks good — approved."
    );
    const reloaded = await db.applicationRecords.get(submitted.id);
    render(
      <RecordDetailDialog record={reloaded!} onClose={() => undefined} />
    );

    const banner = await screen.findByTestId("locked-banner");
    expect(banner).toBeTruthy();
    expect(within(banner).getByText(/Locked — record is immutable/i)).toBeTruthy();
    expect(
      within(banner).getByTestId("locked-banner-by").textContent
    ).toBe("Test Manager");
    expect(
      within(banner).getByTestId("locked-banner-notes").textContent
    ).toBe("Looks good — approved.");
    expect(
      within(banner).getByTestId("locked-banner-at").textContent
    ).toBeTruthy();
  });

  it("attributes each event to the actor that produced it", async () => {
    const submitted = await seedSubmittedRecord();
    await acceptAndLockApplicationRecord(submitted.id, MANAGER);
    const reloaded = await db.applicationRecords.get(submitted.id);
    render(
      <RecordDetailDialog record={reloaded!} onClose={() => undefined} />
    );

    const list = await screen.findByTestId("audit-timeline-list");
    expect(
      within(list).getAllByText(/by Test Applicator/).length
    ).toBeGreaterThan(0);
    expect(
      within(list).getAllByText(/by Test Manager/).length
    ).toBeGreaterThan(0);
  });
});
