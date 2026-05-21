import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { db } from "../../db/fieldlogDb";
import { DEMO_ORG_ID, seedDemoData } from "../../db/seed";
import {
  createDraftApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import { SessionProvider } from "../session/SessionContext";
import { RecordsListPage } from "./RecordsListPage";
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

const renderPage = (initialRole: "contractor" | "manager" = "contractor") =>
  render(
    <SessionProvider initialRole={initialRole}>
      <BrowserRouter>
        <RecordsListPage />
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

describe("RecordsListPage — submit affordance wired to the page (regression: drafts could not reach the manager)", () => {
  it("shows a Submit button on a draft row and transitions the record to pending_review when clicked", async () => {
    const user = userEvent.setup();
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );

    renderPage("contractor");

    const submitButton = await screen.findByRole("button", { name: /^Submit$/i });
    expect(submitButton).toBeTruthy();

    await user.click(submitButton);

    await waitFor(async () => {
      const stored = await db.applicationRecords.get(draft.id);
      expect(stored?.workflowStatus).toBe("pending_review");
    });
  });

  it("renders the +New Record link so the create flow stays reachable", async () => {
    renderPage();
    const links = await screen.findAllByText(/\+ New Record/);
    expect(links.length).toBeGreaterThan(0);
  });

  it("renders without crashing when there are no records", async () => {
    renderPage();
    expect(await screen.findByText(/No records yet\./i)).toBeTruthy();
  });
});
