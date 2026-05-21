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
import type { ApplicationRecord, ContractorInputs } from "../../domain/types";
import { RecordDetailDialog } from "./RecordDetailDialog";

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

async function seedDraft(): Promise<ApplicationRecord> {
  return createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(),
    },
    TEST_APPLICATOR
  );
}

async function seedPending(): Promise<ApplicationRecord> {
  const draft = await seedDraft();
  return submitApplicationRecord(draft.id, TEST_APPLICATOR);
}

async function seedLocked(): Promise<ApplicationRecord> {
  const pending = await seedPending();
  await acceptAndLockApplicationRecord(pending.id, TEST_MANAGER, "Looks good.");
  const reloaded = await db.applicationRecords.get(pending.id);
  return reloaded!;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

describe("RecordDetailDialog — Download JSON / Download PDF button visibility", () => {
  it("renders both download buttons in the dialog footer for a locked record", async () => {
    const locked = await seedLocked();
    render(<RecordDetailDialog record={locked} onClose={() => undefined} />);

    expect(await screen.findByTestId("dialog-download-json")).toBeTruthy();
    expect(await screen.findByTestId("dialog-download-pdf")).toBeTruthy();
  });

  it("does not render either download button on a draft record", async () => {
    const draft = await seedDraft();
    const reloaded = await db.applicationRecords.get(draft.id);
    render(<RecordDetailDialog record={reloaded!} onClose={() => undefined} />);

    // Wait for the dialog to render before asserting absence.
    await screen.findByTestId("audit-timeline");
    expect(screen.queryByTestId("dialog-download-json")).toBeNull();
    expect(screen.queryByTestId("dialog-download-pdf")).toBeNull();
  });

  it("does not render either download button on a pending_review record", async () => {
    const pending = await seedPending();
    const reloaded = await db.applicationRecords.get(pending.id);
    render(<RecordDetailDialog record={reloaded!} onClose={() => undefined} />);

    await screen.findByTestId("audit-timeline");
    expect(reloaded!.workflowStatus).toBe("pending_review");
    expect(screen.queryByTestId("dialog-download-json")).toBeNull();
    expect(screen.queryByTestId("dialog-download-pdf")).toBeNull();
  });
});

describe("RecordDetailDialog — Download JSON / Download PDF click path", () => {
  it("clicking the dialog's Download JSON fires the download path with the .json filename", async () => {
    const locked = await seedLocked();

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
      render(<RecordDetailDialog record={locked} onClose={() => undefined} />);
      const btn = await screen.findByTestId("dialog-download-json");
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

  it("clicking the dialog's Download PDF fires the download path with the .pdf filename", async () => {
    const locked = await seedLocked();

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
      render(<RecordDetailDialog record={locked} onClose={() => undefined} />);
      const btn = await screen.findByTestId("dialog-download-pdf");
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
