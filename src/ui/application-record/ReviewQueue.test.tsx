import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../../db/fieldlogDb";
import { seedDemoData, DEMO_ORG_ID } from "../../db/seed";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  requestCorrectionForApplicationRecord,
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

async function seedDraft(overrides: Partial<ContractorInputs> = {}) {
  return createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs(overrides),
    },
    APPLICATOR
  );
}

async function seedPendingReview(overrides?: Partial<ContractorInputs>) {
  const draft = await seedDraft(overrides);
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

describe("ReviewQueue", () => {
  it("renders an empty-state alert when no records are awaiting review", async () => {
    renderWithManagerSession();
    expect(await screen.findByTestId("review-queue-empty")).toBeTruthy();
  });

  it("excludes drafts and locked records from the queue", async () => {
    await seedDraft();
    const submitted = await seedPendingReview();
    const lockedDraft = await seedDraft({ fieldName: "Field-Locked" });
    const lockedSubmitted = await submitApplicationRecord(
      lockedDraft.id,
      APPLICATOR
    );
    await acceptAndLockApplicationRecord(lockedSubmitted.id, {
      userId: "u-mgr",
      displayName: "Mgr",
    });

    renderWithManagerSession();

    expect(
      await screen.findByTestId(`queue-row-${submitted.id}`)
    ).toBeTruthy();
    expect(screen.queryByTestId(`queue-row-${lockedSubmitted.id}`)).toBeNull();
  });

  it("includes records in needs_correction so the manager sees the loop is open", async () => {
    const pending = await seedPendingReview();
    const corrected = await requestCorrectionForApplicationRecord(
      pending.id,
      { userId: "u-mgr", displayName: "Mgr" },
      "Add target pest."
    );

    renderWithManagerSession();

    expect(
      await screen.findByTestId(`queue-row-${corrected.id}`)
    ).toBeTruthy();
    expect(
      screen.getByTestId(`queue-workflow-${corrected.id}`).textContent
    ).toBe("needs_correction");
  });

  it("sorts the queue oldest-first by createdAt", async () => {
    const older = await seedPendingReview({ fieldName: "Older Field" });
    // Force a measurable gap so createdAt strings differ
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await seedPendingReview({ fieldName: "Newer Field" });

    renderWithManagerSession();

    await screen.findByTestId(`queue-row-${older.id}`);
    await screen.findByTestId(`queue-row-${newer.id}`);

    const queue = screen.getByTestId("review-queue");
    const rows = within(queue).getAllByText(/Field/i);
    const olderIndex = rows.findIndex((n) => n.textContent?.includes("Older"));
    const newerIndex = rows.findIndex((n) => n.textContent?.includes("Newer"));
    expect(olderIndex).toBeGreaterThanOrEqual(0);
    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(olderIndex).toBeLessThan(newerIndex);
    // Anchor assertions on real IDs so future test data shape changes still hold up.
    expect(older.id).not.toBe(newer.id);
  });

  it("locks a pending record via the row's Lock button after confirming", async () => {
    const user = userEvent.setup();
    const submitted = await seedPendingReview();

    renderWithManagerSession();

    const lockBtn = await screen.findByTestId(`queue-lock-${submitted.id}`);
    await user.click(lockBtn);

    // The row's Lock button now only opens the confirm dialog —
    // the record must NOT yet be locked until the manager confirms.
    let beforeConfirm = await db.applicationRecords.get(submitted.id);
    expect(beforeConfirm?.workflowStatus).not.toBe("locked");

    const confirmBtn = await screen.findByTestId("lock-confirm-accept");
    await user.click(confirmBtn);

    await waitFor(async () => {
      const after = await db.applicationRecords.get(submitted.id);
      expect(after?.workflowStatus).toBe("locked");
    });

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(submitted.id)
      .toArray();
    const lockedEvent = events.find((e) => e.type === "locked");
    expect(lockedEvent?.actorDisplayName).toBe("Demo Manager");
  });

  it("opens the lock confirm dialog with record context when Lock is clicked", async () => {
    const user = userEvent.setup();
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    await user.click(await screen.findByTestId(`queue-lock-${submitted.id}`));

    const dialog = await screen.findByTestId("lock-confirm-dialog");
    expect(
      within(dialog).getByText(/permanently freezes the record/i)
    ).toBeTruthy();
    expect(within(dialog).getByText(/Field 7/)).toBeTruthy();
  });

  it("cancels the lock and leaves the record untouched", async () => {
    const user = userEvent.setup();
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    await user.click(await screen.findByTestId(`queue-lock-${submitted.id}`));
    await user.click(await screen.findByTestId("lock-confirm-cancel"));

    // Dialog closes
    await waitFor(() => {
      expect(screen.queryByTestId("lock-confirm-dialog")).toBeNull();
    });
    const after = await db.applicationRecords.get(submitted.id);
    expect(after?.workflowStatus).not.toBe("locked");
  });

  it("includes the review note in the lock confirm dialog when one was entered", async () => {
    const user = userEvent.setup();
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    const row = await screen.findByTestId(`queue-row-${submitted.id}`);
    await user.type(
      within(row).getByLabelText(/review notes/i),
      "All good — proceed."
    );
    await user.click(await screen.findByTestId(`queue-lock-${submitted.id}`));

    const dialog = await screen.findByTestId("lock-confirm-dialog");
    expect(
      within(dialog).getByText(/All good — proceed\./)
    ).toBeTruthy();
  });

  it("requests correction with notes and clears the input after success", async () => {
    const user = userEvent.setup();
    const submitted = await seedPendingReview();

    renderWithManagerSession();

    const correctionInput = await screen.findByLabelText(/correction notes/i);
    await user.type(correctionInput, "Add target pest.");
    await user.click(screen.getByTestId(`queue-correct-${submitted.id}`));

    await waitFor(async () => {
      const after = await db.applicationRecords.get(submitted.id);
      expect(after?.workflowStatus).toBe("needs_correction");
    });

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(submitted.id)
      .toArray();
    const correctionEvent = events.find(
      (e) => e.type === "correction_requested"
    );
    expect(correctionEvent?.actorDisplayName).toBe("Demo Manager");
    expect(correctionEvent?.metadata?.correctionNotes).toBe("Add target pest.");
  });

  it("disables the Request correction button until notes are entered", async () => {
    await seedPendingReview();
    renderWithManagerSession();

    const correctBtn = await screen.findByRole("button", {
      name: /request correction/i,
    });
    expect((correctBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides lock/correction affordances on needs_correction rows", async () => {
    const pending = await seedPendingReview();
    await requestCorrectionForApplicationRecord(
      pending.id,
      { userId: "u-mgr", displayName: "Mgr" },
      "Fix wind."
    );

    renderWithManagerSession();

    const row = await screen.findByTestId(`queue-row-${pending.id}`);
    expect(within(row).queryByRole("button", { name: /^lock$/i })).toBeNull();
    expect(
      within(row).queryByRole("button", { name: /request correction/i })
    ).toBeNull();
    expect(within(row).getByText(/Waiting on contractor/i)).toBeTruthy();
  });

  it("shows pending and needs_correction counts in the header", async () => {
    const a = await seedPendingReview({ fieldName: "Alpha" });
    const b = await seedPendingReview({ fieldName: "Beta" });
    await requestCorrectionForApplicationRecord(
      b.id,
      { userId: "u-mgr", displayName: "Mgr" },
      "fix it"
    );
    void a;

    renderWithManagerSession();

    await screen.findByTestId(`queue-row-${a.id}`);
    await waitFor(() => {
      expect(
        screen.getByTestId("queue-count-pending").textContent
      ).toBe("1 pending");
      expect(
        screen.getByTestId("queue-count-correction").textContent
      ).toBe("1 needs correction");
    });
  });

  it("filters the queue by applicator, farm, field, or product substring", async () => {
    const user = userEvent.setup();
    const alpha = await seedPendingReview({
      fieldName: "Alpha Field",
      farmName: "Big Farm",
    });
    const beta = await seedPendingReview({
      fieldName: "Beta Field",
      farmName: "Small Farm",
    });

    renderWithManagerSession();

    await screen.findByTestId(`queue-row-${alpha.id}`);
    await screen.findByTestId(`queue-row-${beta.id}`);

    await user.type(
      screen.getByTestId("review-queue-filter").querySelector("input")!,
      "alpha"
    );

    await waitFor(() => {
      expect(screen.getByTestId(`queue-row-${alpha.id}`)).toBeTruthy();
      expect(screen.queryByTestId(`queue-row-${beta.id}`)).toBeNull();
    });
  });

  it("shows a filtered-empty alert when filter matches nothing", async () => {
    const user = userEvent.setup();
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    // Wait for the row to load so the filter input becomes enabled before we type.
    await screen.findByTestId(`queue-row-${submitted.id}`);

    await user.type(
      screen.getByTestId("review-queue-filter").querySelector("input")!,
      "this-does-not-exist-xyz"
    );

    await waitFor(() => {
      expect(screen.getByTestId("review-queue-filtered-empty")).toBeTruthy();
    });
  });

  it("opens RecordDetailDialog when Details is clicked", async () => {
    const user = userEvent.setup();
    const submitted = await seedPendingReview();
    renderWithManagerSession();

    const row = await screen.findByTestId(`queue-row-${submitted.id}`);
    await user.click(within(row).getByRole("button", { name: /details/i }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(
      screen.getByText(new RegExp(submitted.id.slice(0, 8), "i"))
    ).toBeTruthy();
  });
});
