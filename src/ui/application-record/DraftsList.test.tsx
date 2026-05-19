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
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import type { ContractorInputs } from "../../domain/types";
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
  applicationMethod: "Ground broadcast",
  rateApplied: "1 qt/ac",
  totalAmountApplied: "10 gal",

  temperature: "72F",
  windSpeed: "5 mph",
  windDirection: "S",

  attestationConfirmed: true,
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

async function seedUnattestedDraft() {
  return createDraftApplicationRecord(
    {
      organizationId: DEMO_ORG_ID,
      contractorInputs: buildContractorInputs({ attestationConfirmed: false }),
    },
    TEST_APPLICATOR
  );
}

async function seedPendingReviewRecord() {
  const draft = await seedAttestedDraft();
  return submitApplicationRecord(draft.id, TEST_APPLICATOR);
}

async function seedLockedRecord() {
  const submitted = await seedPendingReviewRecord();
  return acceptAndLockApplicationRecord(submitted.id, TEST_MANAGER);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

describe("DraftsList submit affordance", () => {
  it("shows a Submit button on draft rows and hides it once submitted", async () => {
    const draft = await seedAttestedDraft();
    render(<DraftsList />);

    await screen.findByTestId(`workflow-${draft.id}`);
    expect(screen.getByRole("button", { name: /submit/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByTestId(`workflow-${draft.id}`).textContent).toBe(
        "pending_review"
      );
    });

    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });

  it("transitions draft to pending_review and freezes a ProductSnapshot via the service", async () => {
    const draft = await seedAttestedDraft();
    render(<DraftsList />);

    await screen.findByTestId(`workflow-${draft.id}`);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(async () => {
      const updated = await db.applicationRecords.get(draft.id);
      expect(updated?.workflowStatus).toBe("pending_review");
      expect(updated?.syncStatus).toBe("queued");
      expect(updated?.productSnapshotId).toBeDefined();
    });

    const updated = await db.applicationRecords.get(draft.id);
    const snapshot = await db.productSnapshots.get(updated!.productSnapshotId!);
    expect(snapshot).toBeDefined();
    expect(snapshot!.applicationRecordId).toBe(draft.id);
    expect(snapshot!.epaRegistrationNumber).toBe("12345-678");

    expect(screen.getByTestId(`workflow-${draft.id}`).textContent).toBe(
      "pending_review"
    );
    expect(screen.getByTestId(`sync-${draft.id}`).textContent).toBe("queued");
  });

  it("disables Submit and surfaces attestation requirement when attestation is not confirmed", async () => {
    const draft = await seedUnattestedDraft();
    render(<DraftsList />);

    await screen.findByTestId(`workflow-${draft.id}`);

    const submitBtn = screen.getByRole("button", {
      name: /submit/i,
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(
      screen.getByText(/attestation required to submit/i)
    ).toBeTruthy();

    expect(await db.applicationRecords.get(draft.id)).toMatchObject({
      workflowStatus: "draft",
    });
  });

  it("records the submitted event with the UI-layer demo actor (no seed coupling)", async () => {
    const draft = await seedAttestedDraft();
    render(<DraftsList />);
    await screen.findByTestId(`workflow-${draft.id}`);

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(async () => {
      const updated = await db.applicationRecords.get(draft.id);
      expect(updated?.workflowStatus).toBe("pending_review");
    });

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(draft.id)
      .toArray();
    const submitted = events.find((e) => e.type === "submitted");
    expect(submitted).toBeDefined();
    expect(submitted!.actorUserId).toBe("user-demo-applicator");
    expect(submitted!.actorDisplayName).toBe("Demo Applicator");
  });

  it("only renders submit affordance for draft rows", async () => {
    const draftA = await seedAttestedDraft();
    const draftB = await seedAttestedDraft();
    render(<DraftsList />);

    await screen.findByTestId(`workflow-${draftA.id}`);
    expect(screen.getAllByRole("button", { name: /submit/i })).toHaveLength(2);

    fireEvent.click(
      within(screen.getByTestId(`workflow-${draftA.id}`).closest("li")!).getByRole(
        "button",
        { name: /submit/i }
      )
    );

    await waitFor(() => {
      expect(screen.getByTestId(`workflow-${draftA.id}`).textContent).toBe(
        "pending_review"
      );
    });

    const remaining = screen.getAllByRole("button", { name: /submit/i });
    expect(remaining).toHaveLength(1);
    expect(screen.getByTestId(`workflow-${draftB.id}`).textContent).toBe(
      "draft"
    );
  });
});

describe("DraftsList lock affordance", () => {
  it("shows a Lock button only on pending_review rows (not draft, not locked)", async () => {
    const draft = await seedAttestedDraft();
    const pending = await seedPendingReviewRecord();
    const locked = await seedLockedRecord();

    render(<DraftsList />);

    await screen.findByTestId(`workflow-${draft.id}`);
    await screen.findByTestId(`workflow-${pending.id}`);
    await screen.findByTestId(`workflow-${locked.id}`);

    const lockButtons = screen.getAllByRole("button", { name: /^lock$/i });
    expect(lockButtons).toHaveLength(1);

    const draftRow = screen.getByTestId(`workflow-${draft.id}`).closest("li")!;
    expect(within(draftRow).queryByRole("button", { name: /^lock$/i })).toBeNull();

    const lockedRow = screen
      .getByTestId(`workflow-${locked.id}`)
      .closest("li")!;
    expect(within(lockedRow).queryByRole("button", { name: /^lock$/i })).toBeNull();
    expect(within(lockedRow).queryByRole("button", { name: /submit/i })).toBeNull();

    const pendingRow = screen
      .getByTestId(`workflow-${pending.id}`)
      .closest("li")!;
    expect(
      within(pendingRow).getByRole("button", { name: /^lock$/i })
    ).toBeTruthy();
  });

  it("transitions pending_review to locked and persists managerInputs with the UI-layer manager actor", async () => {
    const pending = await seedPendingReviewRecord();
    render(<DraftsList />);

    await screen.findByTestId(`workflow-${pending.id}`);
    expect(screen.getByTestId(`workflow-${pending.id}`).textContent).toBe(
      "pending_review"
    );

    const notesInput = screen.getByLabelText(/review notes/i);
    fireEvent.change(notesInput, { target: { value: "Looks good." } });

    fireEvent.click(screen.getByRole("button", { name: /^lock$/i }));

    await waitFor(() => {
      expect(screen.getByTestId(`workflow-${pending.id}`).textContent).toBe(
        "locked"
      );
    });

    const updated = await db.applicationRecords.get(pending.id);
    expect(updated?.workflowStatus).toBe("locked");
    expect(updated?.managerInputs.reviewedBy).toBe("Demo Manager");
    expect(updated?.managerInputs.reviewedAt).toBeDefined();
    expect(updated?.managerInputs.reviewNotes).toBe("Looks good.");
    expect(updated?.system.lockedAt).toBeDefined();

    expect(screen.queryByRole("button", { name: /^lock$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });

  it("records reviewed and locked events with the UI-layer demo manager (no seed coupling)", async () => {
    const pending = await seedPendingReviewRecord();
    render(<DraftsList />);

    await screen.findByTestId(`workflow-${pending.id}`);
    fireEvent.click(screen.getByRole("button", { name: /^lock$/i }));

    await waitFor(async () => {
      const updated = await db.applicationRecords.get(pending.id);
      expect(updated?.workflowStatus).toBe("locked");
    });

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(pending.id)
      .toArray();
    const reviewed = events.find((e) => e.type === "reviewed");
    const locked = events.find((e) => e.type === "locked");

    expect(reviewed).toBeDefined();
    expect(reviewed!.actorUserId).toBe("user-demo-manager");
    expect(reviewed!.actorDisplayName).toBe("Demo Manager");

    expect(locked).toBeDefined();
    expect(locked!.actorUserId).toBe("user-demo-manager");
    expect(locked!.actorDisplayName).toBe("Demo Manager");
  });

  it("leaves contractorInputs unchanged after lock", async () => {
    const pending = await seedPendingReviewRecord();
    const before = (await db.applicationRecords.get(pending.id))!
      .contractorInputs;

    render(<DraftsList />);
    await screen.findByTestId(`workflow-${pending.id}`);
    fireEvent.click(screen.getByRole("button", { name: /^lock$/i }));

    await waitFor(async () => {
      const updated = await db.applicationRecords.get(pending.id);
      expect(updated?.workflowStatus).toBe("locked");
    });

    const after = (await db.applicationRecords.get(pending.id))!
      .contractorInputs;
    expect(after).toEqual(before);
  });

  it("omits reviewNotes when input is left blank", async () => {
    const pending = await seedPendingReviewRecord();
    render(<DraftsList />);

    await screen.findByTestId(`workflow-${pending.id}`);
    fireEvent.click(screen.getByRole("button", { name: /^lock$/i }));

    await waitFor(async () => {
      const updated = await db.applicationRecords.get(pending.id);
      expect(updated?.workflowStatus).toBe("locked");
    });

    const updated = await db.applicationRecords.get(pending.id);
    expect(updated?.managerInputs.reviewNotes).toBeUndefined();
  });
});
