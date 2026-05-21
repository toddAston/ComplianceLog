import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { db } from "../../db/fieldlogDb";
import { seedDemoData, DEMO_ORG_ID } from "../../db/seed";
import {
  createDraftApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import type { ContractorInputs } from "../../domain/types";
import { DraftsList } from "./DraftsList";

const TEST_APPLICATOR: ActorContext = {
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

async function seedAttestedDraft() {
  return createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(),
    },
    TEST_APPLICATOR
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

describe("DraftsList row-click opens detail dialog", () => {
  it("opens RecordDetailDialog when the row card itself is clicked", async () => {
    const draft = await seedAttestedDraft();
    render(<DraftsList />);

    const row = await screen.findByTestId(`draft-row-${draft.id}`);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(row);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(
      within(dialog).getByText(new RegExp(draft.id.slice(0, 8), "i"))
    ).toBeTruthy();
  });

  it("opens RecordDetailDialog when Enter is pressed on the focused row", async () => {
    const draft = await seedAttestedDraft();
    render(<DraftsList />);

    const row = await screen.findByTestId(`draft-row-${draft.id}`);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(row, { key: "Enter" });

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
  });

  it("does NOT open RecordDetailDialog when the Submit button is clicked", async () => {
    const draft = await seedAttestedDraft();
    render(<DraftsList />);

    const row = await screen.findByTestId(`draft-row-${draft.id}`);
    const submitBtn = within(row).getByRole("button", { name: /submit/i });

    fireEvent.click(submitBtn);

    // Wait for the submit action to take effect.
    await waitFor(async () => {
      const updated = await db.applicationRecords.get(draft.id);
      expect(updated?.workflowStatus).toBe("pending_review");
    });

    // The dialog must not have opened from clicking Submit.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
