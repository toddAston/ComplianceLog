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
