import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { db } from "../../db/fieldlogDb";
import { seedDemoData, DEMO_ORG_ID } from "../../db/seed";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import type { ContractorInputs } from "../../domain/types";
import { SessionProvider } from "../session/SessionContext";
import { DraftsList } from "./DraftsList";

const TEST_APPLICATOR: ActorContext = {
  userId: "user-test-applicator",
  displayName: "Test Applicator",
};

const TEST_MANAGER: ActorContext = {
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

async function seedDraft() {
  return createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(),
    },
    TEST_APPLICATOR
  );
}

async function seedLockedRecord() {
  const draft = await seedDraft();
  await submitApplicationRecord(draft.id, TEST_APPLICATOR);
  return acceptAndLockApplicationRecord(draft.id, TEST_MANAGER, "Looks good.");
}

function renderDraftsList() {
  return render(
    <SessionProvider initialRole="contractor">
      <DraftsList />
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

describe("DraftsList — Download JSON / Download PDF button visibility", () => {
  it("renders Download JSON on a locked row", async () => {
    const locked = await seedLockedRecord();
    renderDraftsList();

    const btn = await screen.findByTestId(`download-json-${locked.id}`);
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe("BUTTON");
  });

  it("renders Download PDF on a locked row", async () => {
    const locked = await seedLockedRecord();
    renderDraftsList();

    const btn = await screen.findByTestId(`download-pdf-${locked.id}`);
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe("BUTTON");
  });

  it("does not render either download button on a draft row", async () => {
    const draft = await seedDraft();
    renderDraftsList();

    // Wait for the row to render before asserting absence of the buttons.
    await screen.findByTestId(`workflow-${draft.id}`);
    expect(screen.queryByTestId(`download-json-${draft.id}`)).toBeNull();
    expect(screen.queryByTestId(`download-pdf-${draft.id}`)).toBeNull();
  });
});

describe("DraftsList — Download JSON / Download PDF click path", () => {
  it("clicking Download JSON fires the download path with a blob: href and application-record-{id}.json filename", async () => {
    const locked = await seedLockedRecord();

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(
      (b: Blob) => `blob:test/${(b as Blob).size}`
    ) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    const clickedAnchors: HTMLAnchorElement[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function clickStub(this: HTMLAnchorElement) {
        clickedAnchors.push(this);
      });

    try {
      renderDraftsList();
      const btn = await screen.findByTestId(`download-json-${locked.id}`);
      fireEvent.click(btn);

      await waitFor(() => {
        expect(clickSpy).toHaveBeenCalledTimes(1);
      });

      expect(clickedAnchors).toHaveLength(1);
      const anchor = clickedAnchors[0];
      expect(anchor.href.startsWith("blob:")).toBe(true);
      expect(anchor.download).toBe(`application-record-${locked.id}.json`);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("clicking Download PDF fires the download path with a blob: href and application-record-{id}.pdf filename", async () => {
    const locked = await seedLockedRecord();

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(
      (b: Blob) => `blob:test/${(b as Blob).size}`
    ) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    const clickedAnchors: HTMLAnchorElement[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function clickStub(this: HTMLAnchorElement) {
        clickedAnchors.push(this);
      });

    try {
      renderDraftsList();
      const btn = await screen.findByTestId(`download-pdf-${locked.id}`);
      fireEvent.click(btn);

      await waitFor(() => {
        expect(clickSpy).toHaveBeenCalledTimes(1);
      });

      expect(clickedAnchors).toHaveLength(1);
      const anchor = clickedAnchors[0];
      expect(anchor.href.startsWith("blob:")).toBe(true);
      expect(anchor.download).toBe(`application-record-${locked.id}.pdf`);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
