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
  submitApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import type { ContractorInputs } from "../../domain/types";
import { ReviewQueue } from "./ReviewQueue";
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

async function seedPendingReview(overrides?: Partial<ContractorInputs>) {
  const draft = await createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(overrides),
    },
    APPLICATOR
  );
  return submitApplicationRecord(draft.id, APPLICATOR);
}

function renderWithManagerSession() {
  return render(
    <SessionProvider initialRole="manager">
      <ReviewQueue />
    </SessionProvider>
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

describe("ReviewQueue row-click opens detail dialog", () => {
  it("opens RecordDetailDialog when the row card itself is clicked", async () => {
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    const row = await screen.findByTestId(`queue-row-${submitted.id}`);
    expect(document.querySelector(".record-detail-dialog")).toBeNull();

    fireEvent.click(row);

    const detailDialog = await waitFor(() => {
      const el = document.querySelector(".record-detail-dialog");
      if (!el) throw new Error("record-detail-dialog did not open");
      return el;
    });
    expect(detailDialog).toBeTruthy();
    expect(
      within(detailDialog as HTMLElement).getByText(
        new RegExp(submitted.id.slice(0, 8), "i")
      )
    ).toBeTruthy();
  });

  it("opens RecordDetailDialog when Enter is pressed on the focused row", async () => {
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    const row = await screen.findByTestId(`queue-row-${submitted.id}`);
    expect(document.querySelector(".record-detail-dialog")).toBeNull();

    fireEvent.keyDown(row, { key: "Enter" });

    await waitFor(() => {
      expect(document.querySelector(".record-detail-dialog")).not.toBeNull();
    });
  });

  it("does NOT open RecordDetailDialog when the Lock button is clicked", async () => {
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    await screen.findByTestId(`queue-row-${submitted.id}`);
    const lockBtn = await screen.findByTestId(`queue-lock-${submitted.id}`);

    fireEvent.click(lockBtn);

    // Lock click opens the LockConfirmDialog (not the RecordDetailDialog).
    await screen.findByTestId("lock-confirm-dialog");
    expect(document.querySelector(".record-detail-dialog")).toBeNull();
  });

  it("does NOT open RecordDetailDialog when the Request correction button is clicked", async () => {
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    const row = await screen.findByTestId(`queue-row-${submitted.id}`);

    // Fill correction notes via change so the button enables.
    const input = within(row)
      .getByLabelText(/correction notes/i)
      .closest("input") as HTMLInputElement | null;
    // MUI TextField: query the actual <input> inside.
    const correctionInput =
      input ?? (within(row).getByLabelText(/correction notes/i) as HTMLInputElement);
    fireEvent.change(correctionInput, { target: { value: "Please fix." } });

    const correctBtn = await screen.findByTestId(`queue-correct-${submitted.id}`);
    fireEvent.click(correctBtn);

    await waitFor(async () => {
      const after = await db.applicationRecords.get(submitted.id);
      expect(after?.workflowStatus).toBe("needs_correction");
    });

    expect(document.querySelector(".record-detail-dialog")).toBeNull();
  });
});
