import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../../db/fieldlogDb";
import { ContractorManager } from "./ContractorManager";

const ORG = "org-test-contractor-detail";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => cleanup());

async function seedThreeApplicators() {
  const baseCreatedAt = new Date().toISOString();
  await db.applicators.bulkAdd([
    {
      id: "a-acme-1",
      organizationId: ORG,
      contractorCompanyName: "Acme Spray Co",
      applicatorName: "Alice Anders",
      certificationNumber: "MO-100",
      createdAt: baseCreatedAt,
    },
    {
      id: "a-acme-2",
      organizationId: ORG,
      contractorCompanyName: "Acme Spray Co",
      applicatorName: "Brad Brooks",
      createdAt: baseCreatedAt,
    },
    {
      id: "a-delta-1",
      organizationId: ORG,
      contractorCompanyName: "Delta Ag Services",
      applicatorName: "Carla Cruz",
      certificationNumber: "MO-200",
      createdAt: baseCreatedAt,
    },
  ]);
}

describe("ContractorManager — company groups are collapsible", () => {
  it("renders one collapsible header per company with applicator count and starts expanded", async () => {
    await seedThreeApplicators();
    render(<ContractorManager organizationId={ORG} />);

    await screen.findByTestId("contractor-list");
    const acmeToggle = screen.getByTestId(
      "contractor-company-toggle-acme-spray-co"
    );
    const deltaToggle = screen.getByTestId(
      "contractor-company-toggle-delta-ag-services"
    );
    expect(acmeToggle.getAttribute("aria-expanded")).toBe("true");
    expect(deltaToggle.getAttribute("aria-expanded")).toBe("true");

    // Applicator counts surface in the header.
    expect(acmeToggle.textContent).toMatch(/2\s+applicators/i);
    expect(deltaToggle.textContent).toMatch(/1\s+applicator(?!s)/i);

    // All three applicator cards are reachable.
    expect(screen.getByTestId("contractor-row-a-acme-1")).toBeTruthy();
    expect(screen.getByTestId("contractor-row-a-acme-2")).toBeTruthy();
    expect(screen.getByTestId("contractor-row-a-delta-1")).toBeTruthy();
  });

  it("clicking a header collapses just that company's body", async () => {
    await seedThreeApplicators();
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);
    const acmeToggle = await screen.findByTestId(
      "contractor-company-toggle-acme-spray-co"
    );

    await user.click(acmeToggle);

    expect(acmeToggle.getAttribute("aria-expanded")).toBe("false");
    // Acme's two cards are hidden; Delta's stays visible.
    expect(screen.queryByTestId("contractor-row-a-acme-1")).toBeNull();
    expect(screen.queryByTestId("contractor-row-a-acme-2")).toBeNull();
    expect(screen.getByTestId("contractor-row-a-delta-1")).toBeTruthy();
  });

  it("clicking a collapsed header expands it back", async () => {
    await seedThreeApplicators();
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);
    const acmeToggle = await screen.findByTestId(
      "contractor-company-toggle-acme-spray-co"
    );

    await user.click(acmeToggle); // collapse
    await user.click(acmeToggle); // expand

    expect(acmeToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("contractor-row-a-acme-1")).toBeTruthy();
  });
});

describe("ContractorManager — clicking an applicator card opens the detail dialog", () => {
  it("opens the dialog and pre-fills every tracked field", async () => {
    await db.applicators.add({
      id: "a-full",
      organizationId: ORG,
      contractorCompanyName: "Full Detail Co",
      applicatorName: "Dana Detailed",
      certificationNumber: "MO-999",
      emailAddress: "dana@example.com",
      phoneNumber: "555-0100",
      defaultApplicatorCategory: "certified_commercial",
      licenseExpiryDate: "2027-12-31",
      notes: "Lead applicator on RUP soil insecticide.",
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(await screen.findByTestId("contractor-row-button-a-full"));

    const dialog = await screen.findByTestId("contractor-detail-dialog");
    expect(
      (within(dialog).getByLabelText("Applicator name") as HTMLInputElement)
        .value
    ).toBe("Dana Detailed");
    expect(
      (within(dialog).getByLabelText("Contractor company") as HTMLInputElement)
        .value
    ).toBe("Full Detail Co");
    expect(
      (within(dialog).getByLabelText("Certification number") as HTMLInputElement)
        .value
    ).toBe("MO-999");
    expect(
      (within(dialog).getByLabelText("Email address") as HTMLInputElement).value
    ).toBe("dana@example.com");
    expect(
      (within(dialog).getByLabelText("Phone number") as HTMLInputElement).value
    ).toBe("555-0100");
    expect(
      (within(dialog).getByLabelText("License expiry date") as HTMLInputElement)
        .value
    ).toBe("2027-12-31");
    expect(
      (within(dialog).getByLabelText("Notes") as HTMLInputElement).value
    ).toBe("Lead applicator on RUP soil insecticide.");
  });

  it("persists edits to Dexie when Save is clicked", async () => {
    await db.applicators.add({
      id: "a-edit",
      organizationId: ORG,
      contractorCompanyName: "Edit Co",
      applicatorName: "Edit Me",
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(await screen.findByTestId("contractor-row-button-a-edit"));
    const dialog = await screen.findByTestId("contractor-detail-dialog");

    await user.clear(within(dialog).getByLabelText("Applicator name"));
    await user.type(within(dialog).getByLabelText("Applicator name"), "Edited Name");
    await user.type(
      within(dialog).getByLabelText("Certification number"),
      "MO-7777"
    );
    await user.type(
      within(dialog).getByLabelText("Email address"),
      "edited@example.com"
    );
    await user.click(screen.getByTestId("contractor-detail-save"));

    // Dialog closes on success.
    await waitFor(() => {
      expect(screen.queryByTestId("contractor-detail-dialog")).toBeNull();
    });

    const stored = await db.applicators.get("a-edit");
    expect(stored?.applicatorName).toBe("Edited Name");
    expect(stored?.certificationNumber).toBe("MO-7777");
    expect(stored?.emailAddress).toBe("edited@example.com");
  });

  it("surfaces a validation error when the applicator name is cleared", async () => {
    await db.applicators.add({
      id: "a-empty",
      organizationId: ORG,
      contractorCompanyName: "Empty Co",
      applicatorName: "Don't Erase Me",
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(await screen.findByTestId("contractor-row-button-a-empty"));
    const dialog = await screen.findByTestId("contractor-detail-dialog");

    await user.clear(within(dialog).getByLabelText("Applicator name"));
    await user.click(screen.getByTestId("contractor-detail-save"));

    expect(
      await within(dialog).findByTestId("contractor-detail-error")
    ).toBeTruthy();
    // The stored row is unchanged.
    const stored = await db.applicators.get("a-empty");
    expect(stored?.applicatorName).toBe("Don't Erase Me");
  });

  it("Cancel closes the dialog without writing", async () => {
    await db.applicators.add({
      id: "a-cancel",
      organizationId: ORG,
      contractorCompanyName: "Cancel Co",
      applicatorName: "Cancel Me",
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(await screen.findByTestId("contractor-row-button-a-cancel"));
    const dialog = await screen.findByTestId("contractor-detail-dialog");
    await user.type(within(dialog).getByLabelText("Notes"), "uncommitted");
    await user.click(within(dialog).getByRole("button", { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("contractor-detail-dialog")).toBeNull();
    });
    const stored = await db.applicators.get("a-cancel");
    expect(stored?.notes).toBeUndefined();
  });
});
