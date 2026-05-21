import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { db } from "../../db/fieldlogDb";
import { DEMO_ORG_ID, seedDemoData } from "../../db/seed";
import {
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import { SessionProvider } from "../session/SessionContext";
import { ReviewsPage } from "./ReviewsPage";
import type { ContractorInputs } from "../../domain/types";

const TEST_APPLICATOR: ActorContext = {
  userId: "user-test-applicator",
  displayName: "Test Applicator",
};

const buildContractorInputs = (): ContractorInputs => ({
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
});

const renderPage = (initialRole: "contractor" | "manager" = "manager") =>
  render(
    <SessionProvider initialRole={initialRole}>
      <BrowserRouter>
        <ReviewsPage />
      </BrowserRouter>
    </SessionProvider>
  );

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

async function seedSubmittedRecord() {
  const draft = await createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(),
    },
    TEST_APPLICATOR
  );
  await submitApplicationRecord(draft.id, TEST_APPLICATOR);
  return draft.id;
}

describe("ReviewsPage — manager affordances wired to the page (regression: Approve/Request Correction were inert)", () => {
  it("clicking Lock on a pending record transitions it to 'locked' (replaces the previous handler-less mockup)", async () => {
    const user = userEvent.setup();
    const recordId = await seedSubmittedRecord();

    renderPage("manager");

    // The real ReviewQueue uses "Lock" as the action label; the previous
    // mockup labelled this "Approve" with no onClick.
    const lockButton = await screen.findByRole("button", { name: /^Lock$/i });
    await user.click(lockButton);
    // Lock opens a confirmation dialog whose action button reads "Lock permanently".
    const confirm = await screen.findByRole("button", {
      name: /Lock permanently/i,
    });
    await user.click(confirm);

    await waitFor(async () => {
      const stored = await db.applicationRecords.get(recordId);
      expect(stored?.workflowStatus).toBe("locked");
    });
  });

  it("clicking Request correction with notes transitions the record to 'needs_correction'", async () => {
    const user = userEvent.setup();
    const recordId = await seedSubmittedRecord();

    renderPage("manager");

    const notesField = await screen.findByLabelText(/Correction notes/i);
    await user.type(notesField, "Please double-check the rate applied.");

    const correctionButton = screen.getByRole("button", {
      name: /Request correction/i,
    });
    await user.click(correctionButton);

    await waitFor(async () => {
      const stored = await db.applicationRecords.get(recordId);
      expect(stored?.workflowStatus).toBe("needs_correction");
    });
  });

  it("shows the empty state when no records are pending review", async () => {
    renderPage("manager");
    expect(
      await screen.findByText(/No records waiting for review\./i)
    ).toBeTruthy();
  });

  it("gates the queue behind the manager role: contractors see the gate copy, not ReviewQueue", async () => {
    // Even with a record that *would* appear in the queue, a contractor must
    // never see ReviewQueue. The gate lives at the page level (Path A).
    await seedSubmittedRecord();

    renderPage("contractor");

    // Gate copy is shown.
    expect(
      await screen.findByText(/Manager access required/i)
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Switch your demo role to Manager from the Dashboard or mobile menu to review pending submissions\./i
      )
    ).toBeTruthy();
    expect(screen.getByTestId("reviews-manager-gate")).toBeTruthy();

    // ReviewQueue must NOT mount — neither its root nor its empty-state alert
    // (which is what would render for an empty queue) is in the DOM.
    expect(screen.queryByTestId("review-queue")).toBeNull();
    expect(screen.queryByTestId("review-queue-empty")).toBeNull();
    expect(screen.queryByTestId("review-queue-header")).toBeNull();

    // The "Back to Records" link points at /records (no auto-redirect).
    const backLink = screen.getByRole("link", { name: /back to records/i });
    expect(backLink.getAttribute("href")).toBe("/records");
  });
});
