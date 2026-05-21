import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticateForTests } from "../session/testAuth";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";

// Regression for the contractor product rule:
//
//   "As a contractor I shouldn't be able to Save Draft if required fields
//    are missing."
//
// Before this change, the Save Draft button was enabled as soon as farm +
// field + product were chosen — so a contractor could persist a draft with
// no dates, no times, no target pest, no requester, no rate, etc., and a
// downstream manager attempting to lock the record would hit a wall of
// MISSING_REQUIRED_FIELD failures with no clear path to fix.
//
// Now: the outer "Save Draft" button is disabled until every error-severity
// MISSING_REQUIRED_FIELD compliance failure clears (plus the form-level
// Farm/Field/Product/Date/Pest/Rate/Total/Acres/Requester labels). Weather
// rules (severity warning) are intentionally NOT gated — the demo flow allows
// saving a draft before walking to the Weather step, since weather is
// advisory.

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
  authenticateForTests("contractor");
  window.history.pushState({}, "", "/records/new");
});

afterEach(() => {
  cleanup();
});

// Walks the stepper through Step 1 + Step 2 only, leaving Step 3's hard
// required fields empty. After this, Save Draft must STILL be disabled.
async function fillThroughProductStep() {
  const user = userEvent.setup();
  const farmSelect = (await screen.findByLabelText(/Farm/i)) as HTMLSelectElement;
  await waitFor(() => {
    expect(
      Array.from(farmSelect.options).some((o) => o.value === "farm-north")
    ).toBe(true);
  });
  await user.selectOptions(farmSelect, "farm-north");
  const fieldSelect = screen.getByLabelText(/Field/i) as HTMLSelectElement;
  await waitFor(() => {
    expect(
      Array.from(fieldSelect.options).some((o) => o.value === "field-7")
    ).toBe(true);
  });
  await user.selectOptions(fieldSelect, "field-7");
  await user.click(screen.getByRole("button", { name: /^Next/i }));

  const productSelect = (await screen.findByLabelText(/Product/i)) as HTMLSelectElement;
  await waitFor(() => {
    expect(
      Array.from(productSelect.options).some(
        (o) => o.value === "product-example-herbicide-4l"
      )
    ).toBe(true);
  });
  await user.selectOptions(productSelect, "product-example-herbicide-4l");
  return user;
}

// Walks the stepper through every step, filling each error-severity required
// field so the strict Save Draft gate is satisfied at the end.
async function fillEntireForm() {
  const user = await fillThroughProductStep();
  await user.click(screen.getByRole("button", { name: /^Next/i }));

  await user.type(screen.getByLabelText(/Time Start/i), "08:30");
  await user.type(screen.getByLabelText(/Time End/i), "11:30");
  await user.type(screen.getByLabelText(/Target Pest/i), "Waterhemp");
  await user.type(screen.getByLabelText(/Rate per Acre/i), "22");
  await user.type(screen.getByLabelText(/Total Amount/i), "880");
  await user.type(screen.getByLabelText(/Acres Treated/i), "40");
  await user.type(
    screen.getByLabelText(/Requester Name/i),
    "Acme Producer Co."
  );
  await user.type(
    screen.getByLabelText(/Requester Address/i),
    "1234 Main St, Columbia, MO 65201"
  );
  return user;
}

describe("RecordCreatePage — Save Draft strict gate (contractor cannot save with missing required fields)", () => {
  it("Save Draft is disabled on a fresh form (nothing filled in)", async () => {
    render(<App />);
    const button = (await screen.findByTestId(
      "save-draft-button"
    )) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("stays disabled after farm + field + product are picked but Step 3 fields are blank", async () => {
    render(<App />);
    await fillThroughProductStep();
    const button = screen.getByTestId("save-draft-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // The disabled hover-hint enumerates what is still missing — that's the
    // mechanism that tells the contractor *why* the button is off.
    const title = button.getAttribute("title") ?? "";
    expect(title).toMatch(/Required fields still missing/i);
    expect(title).toMatch(/Target Pest/i);
    expect(title).toMatch(/Rate per Acre/i);
    expect(title).toMatch(/Total Amount/i);
    expect(title).toMatch(/Requester Name/i);
    expect(title).toMatch(/Requester Address/i);
  });

  it("becomes enabled once every error-severity required field is filled in", async () => {
    render(<App />);
    await fillEntireForm();
    const button = screen.getByTestId("save-draft-button") as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    // No "Required fields still missing" hover text remains.
    expect(button.getAttribute("title")).toBeNull();
  });

  it("clicking Save Draft once enabled persists the draft and navigates to /records", async () => {
    render(<App />);
    const user = await fillEntireForm();
    const button = screen.getByTestId("save-draft-button") as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    await user.click(button);

    await screen.findByRole("heading", { level: 1, name: /^Records$/ });
    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });
    const [saved] = await db.applicationRecords.toArray();
    expect(saved.workflowStatus).toBe("draft");
    expect(saved.contractorInputs.targetPest).toBe("Waterhemp");
    expect(saved.contractorInputs.requesterName).toBe("Acme Producer Co.");
  });

  it("weather is advisory: Save Draft enables WITHOUT entering temperature / wind (warning-severity rules don't gate)", async () => {
    render(<App />);
    await fillEntireForm();
    // Note: fillEntireForm intentionally never touches Step 4 weather inputs.
    const button = screen.getByTestId("save-draft-button") as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("disabling the button on Step 3 also disables the stepper's Save Draft (Step 5 Next button)", async () => {
    render(<App />);
    const user = await fillThroughProductStep();
    // Advance: Step 2 → 3. Fill End Time so Next is not blocked by the
    // per-step gate, then advance: Step 3 → 4, Step 4 → 5 (Review).
    await user.click(screen.getByRole("button", { name: /^Next/i })); // 2 → 3
    await user.type(screen.getByLabelText(/Time End/i), "11:30");
    await user.click(screen.getByRole("button", { name: /^Next/i })); // 3 → 4
    await user.click(screen.getByRole("button", { name: /^Next/i })); // 4 → 5

    // We're on Review. Both the top "Save Draft" and the stepper "Save Draft"
    // are now in the DOM. Both must be disabled because Target Pest, Rate,
    // Total, Acres, Requester Name + Address are still empty.
    const saveButtons = screen.getAllByRole("button", { name: /Save Draft/i });
    expect(saveButtons.length).toBeGreaterThanOrEqual(1);
    for (const b of saveButtons) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
