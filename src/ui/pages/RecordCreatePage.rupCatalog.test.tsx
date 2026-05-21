import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";

// The global test setup (src/test/setup.ts) only wires fake-indexeddb; it does
// NOT register Testing Library cleanup, so each integration test must reset the
// DOM and Dexie state explicitly. Same pattern as RecordCreatePage.compliancePanel.test.tsx.
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
  window.history.pushState({}, "", "/records/new");
});

afterEach(() => {
  cleanup();
});

async function walkToProductStep(): Promise<{
  user: ReturnType<typeof userEvent.setup>;
  productSelect: HTMLSelectElement;
}> {
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

  // Wait for the curated catalog to surface in the live query before any
  // assertion downstream — without this the options array may still be the
  // legacy-only snapshot from the first render.
  await waitFor(() => {
    expect(
      Array.from(productSelect.options).some((o) => o.value === "rup-100-1075")
    ).toBe(true);
  });
  return { user, productSelect };
}

describe("RecordCreatePage product picker — curated RUP catalog", () => {
  it("contains the legacy demo product (regression guard)", async () => {
    render(<App />);
    const { productSelect } = await walkToProductStep();

    const legacy = Array.from(productSelect.options).find(
      (o) => o.value === "product-example-herbicide-4l"
    );
    expect(legacy).toBeDefined();
    expect(legacy?.textContent).toMatch(/Example Herbicide 4L/i);
  });

  it("surfaces at least 41 products (40 curated RUPs + 1 legacy)", async () => {
    render(<App />);
    const { productSelect } = await walkToProductStep();

    // The first option is the empty "Search or select product..." placeholder.
    const realOptions = Array.from(productSelect.options).filter(
      (o) => o.value !== ""
    );
    expect(realOptions.length).toBeGreaterThanOrEqual(41);
  });

  it("renders well-known EPA RUP product names by visible text", async () => {
    render(<App />);
    const { productSelect } = await walkToProductStep();

    const expected = [
      /Gramoxone 3LB/i,
      /Force 3G/i,
      /Karate EC-W/i,
      /Lannate SP/i,
      /Bonide Orchard Mouse Bait/i,
    ];
    for (const pattern of expected) {
      const match = Array.from(productSelect.options).find((o) =>
        pattern.test(o.textContent ?? "")
      );
      expect(
        match,
        `expected an <option> matching ${pattern} in the product picker`
      ).toBeDefined();
    }
  });

  it("every non-placeholder option carries an rup- id or the legacy id", async () => {
    render(<App />);
    const { productSelect } = await walkToProductStep();

    const realOptions = Array.from(productSelect.options).filter(
      (o) => o.value !== ""
    );
    expect(realOptions.length).toBeGreaterThan(0);
    for (const opt of realOptions) {
      const isLegacy = opt.value === "product-example-herbicide-4l";
      const isCuratedRup = opt.value.startsWith("rup-");
      expect(
        isLegacy || isCuratedRup,
        `option value "${opt.value}" should be the legacy id or start with "rup-"`
      ).toBe(true);
    }
  });

  it("selecting Force 3G flows the real product into the saved draft", async () => {
    render(<App />);
    const { user, productSelect } = await walkToProductStep();

    await user.selectOptions(productSelect, "rup-100-1075");

    // Sanity check the in-step preview echoes the selected product before save.
    // The product name also appears inside the <option>, so use getAllByText
    // and assert at least one match (option + preview div) to avoid the
    // multi-match throw from getByText.
    await waitFor(() => {
      expect(screen.getAllByText(/Force 3G Insecticide/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/EPA Reg #:\s*100-1075/i)).toBeTruthy();
    });

    // Use the OUTER "Save Draft" button (top right), enabled as soon as
    // farm + field + product are picked — matches the existing integration
    // test pattern in DraftApplicationRecordForm.test.tsx.
    const saveButtons = screen.getAllByRole("button", { name: /Save Draft/i });
    // On step 2 (Product), the stepper's Next still reads "Next", so there is
    // exactly one Save Draft button in the DOM at this moment.
    expect(saveButtons.length).toBe(1);
    await user.click(saveButtons[0]);

    // Wait for the navigation off /records/new to complete, then read the
    // persisted record straight from Dexie to verify the product fields landed
    // on contractorInputs as expected.
    await screen.findByRole("heading", { level: 1, name: /^Records$/ });

    await waitFor(async () => {
      const records = await db.applicationRecords.toArray();
      expect(records.length).toBe(1);
    });
    const [saved] = await db.applicationRecords.toArray();
    expect(saved.contractorInputs.productId).toBe("rup-100-1075");
    expect(saved.contractorInputs.productName).toBe("Force 3G Insecticide");
    expect(saved.contractorInputs.epaRegistrationNumber).toBe("100-1075");
    expect(saved.contractorInputs.rupStatus).toBe("yes");
  });
});
