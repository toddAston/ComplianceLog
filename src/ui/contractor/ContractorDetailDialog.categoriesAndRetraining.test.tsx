import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../../db/fieldlogDb";
import { clearRecentValues } from "../../lib/recentValues";
import { ContractorManager } from "./ContractorManager";

const ORG = "org-test-contractor-cat-retrain";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  // Recent-values lives in localStorage outside Dexie; reset between tests so
  // the recent-values test starts from a clean slate.
  clearRecentValues("contractor.company");
  clearRecentValues("contractor.certificationNumber");
  clearRecentValues("contractor.licenseExpiry");
  clearRecentValues("contractor.noncertifiedRupTrainingDate");
});

afterEach(() => cleanup());

async function seed(applicator: {
  id: string;
  applicatorName: string;
  contractorCompanyName: string;
  licenseCategoryCodes?: string[];
}) {
  await db.applicators.add({
    id: applicator.id,
    organizationId: ORG,
    applicatorName: applicator.applicatorName,
    contractorCompanyName: applicator.contractorCompanyName,
    licenseCategoryCodes: applicator.licenseCategoryCodes as never,
    createdAt: new Date().toISOString(),
  });
}

function addDaysIso(date: Date, days: number): string {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  const y = out.getUTCFullYear();
  const m = String(out.getUTCMonth() + 1).padStart(2, "0");
  const d = String(out.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

describe("ContractorDetailDialog — license categories", () => {
  it("renders both grouped fieldsets with every code visible", async () => {
    await seed({
      id: "a-cats",
      applicatorName: "Cat Test",
      contractorCompanyName: "Cat Co",
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(await screen.findByTestId("contractor-row-button-a-cats"));
    const dialog = await screen.findByTestId("contractor-detail-dialog");

    const commercial = within(dialog).getByTestId(
      "license-categories-commercial"
    );
    const privateBox = within(dialog).getByTestId("license-categories-private");

    // All 19 commercial-side codes (Cat 1, 1a, 1b, 2, 3, 4, 5, 5b, 6, 7, 7a,
    // 7b, 7c, 8, 9, 10, 11, 12, 13).
    const commercialCodes = [
      "cat_1_agricultural",
      "cat_1a_agricultural_plant",
      "cat_1b_agricultural_animal",
      "cat_2_forest",
      "cat_3_ornamental_turf",
      "cat_4_seed_treatment",
      "cat_5_aquatic",
      "cat_5b_sewer_root",
      "cat_6_right_of_way",
      "cat_7_structural",
      "cat_7a_general_structural",
      "cat_7b_termite",
      "cat_7c_fumigation",
      "cat_8_public_health",
      "cat_9_regulatory",
      "cat_10_demonstration_research",
      "cat_11_wood_products",
      "cat_12_soil_fumigation",
      "cat_13_aerial",
    ];
    for (const code of commercialCodes) {
      expect(
        within(commercial).getByTestId(`license-category-${code}`)
      ).toBeTruthy();
    }
    expect(commercialCodes).toHaveLength(19);

    // All 4 private codes (Cat 20-23).
    const privateCodes = [
      "cat_20_general_agricultural",
      "cat_21_soil_fumigation",
      "cat_22_non_soil_fumigation",
      "cat_23_aerial",
    ];
    for (const code of privateCodes) {
      expect(
        within(privateBox).getByTestId(`license-category-${code}`)
      ).toBeTruthy();
    }
    expect(privateCodes).toHaveLength(4);

    // Legend copy distinguishes the two fieldsets.
    expect(commercial.textContent).toMatch(/Commercial/i);
    expect(privateBox.textContent).toMatch(/Private/i);
  });

  it("picking two commercial categories and saving persists them", async () => {
    await seed({
      id: "a-pick",
      applicatorName: "Picker",
      contractorCompanyName: "Pick Co",
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(await screen.findByTestId("contractor-row-button-a-pick"));
    const dialog = await screen.findByTestId("contractor-detail-dialog");

    await user.click(
      within(dialog).getByTestId("license-category-cat_1a_agricultural_plant")
    );
    await user.click(
      within(dialog).getByTestId("license-category-cat_7a_general_structural")
    );
    await user.click(screen.getByTestId("contractor-detail-save"));

    await waitFor(() => {
      expect(screen.queryByTestId("contractor-detail-dialog")).toBeNull();
    });

    const stored = await db.applicators.get("a-pick");
    expect(stored?.licenseCategoryCodes).toEqual([
      "cat_1a_agricultural_plant",
      "cat_7a_general_structural",
    ]);
  });

  it("pre-existing categories are checked when the dialog opens", async () => {
    await seed({
      id: "a-preset",
      applicatorName: "Preset",
      contractorCompanyName: "Preset Co",
      licenseCategoryCodes: ["cat_7b_termite", "cat_20_general_agricultural"],
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(
      await screen.findByTestId("contractor-row-button-a-preset")
    );
    const dialog = await screen.findByTestId("contractor-detail-dialog");

    // The wrapping FormControlLabel carries the testid; the actual checkbox
    // input is rendered by MUI inside it. Reach the input via the wrapper.
    const findCheckbox = (testId: string) =>
      within(dialog)
        .getByTestId(testId)
        .querySelector("input[type='checkbox']") as HTMLInputElement;

    const termite = findCheckbox("license-category-cat_7b_termite");
    const generalAg = findCheckbox("license-category-cat_20_general_agricultural");
    const unchecked = findCheckbox("license-category-cat_3_ornamental_turf");

    expect(termite).not.toBeNull();
    expect(termite.checked).toBe(true);
    expect(generalAg.checked).toBe(true);
    expect(unchecked.checked).toBe(false);
  });
});

describe("ContractorDetailDialog — noncertified RUP retraining", () => {
  it("training type = core_exam + date 2026-01-01 derives expiry 2029-01-01", async () => {
    await seed({
      id: "a-core",
      applicatorName: "Core Exam Holder",
      contractorCompanyName: "Core Co",
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(await screen.findByTestId("contractor-row-button-a-core"));
    const dialog = await screen.findByTestId("contractor-detail-dialog");

    await user.click(
      within(dialog).getByTestId("retraining-type-core_exam")
    );
    const dateInput = within(dialog).getByLabelText(
      "Noncertified RUP training date"
    );
    await user.type(dateInput, "2026-01-01");

    // 2026-01-01 + 3 years (core_exam cycle) = 2029-01-01.
    const expiryLine =
      within(dialog).queryByTestId("retraining-expiry-info") ??
      within(dialog).getByTestId("retraining-expiry-warning");
    expect(expiryLine.textContent).toMatch(/2029-01-01/);
  });

  it("training_program + date 60+ days from today renders no warning; +5 days warns", async () => {
    await seed({
      id: "a-warn",
      applicatorName: "Warn Test",
      contractorCompanyName: "Warn Co",
    });
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.click(await screen.findByTestId("contractor-row-button-a-warn"));
    const dialog = await screen.findByTestId("contractor-detail-dialog");

    // training_program = 1-year cycle. Pick a training date such that
    // (date + 1y) is 70 days in the future → derived expiry is 70 days out,
    // outside the 30-day warning window.
    const today = new Date();
    const utcToday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );
    const safeTrainingDate = (() => {
      const trainingDate = new Date(utcToday);
      trainingDate.setUTCFullYear(trainingDate.getUTCFullYear() - 1);
      trainingDate.setUTCDate(trainingDate.getUTCDate() + 70);
      return addDaysIso(trainingDate, 0);
    })();

    await user.click(
      within(dialog).getByTestId("retraining-type-training_program")
    );
    const dateInput = within(dialog).getByLabelText(
      "Noncertified RUP training date"
    );
    await user.type(dateInput, safeTrainingDate);

    // Far-out: no warning, info banner only.
    expect(
      within(dialog).queryByTestId("retraining-expiry-warning")
    ).toBeNull();
    expect(
      within(dialog).getByTestId("retraining-expiry-info")
    ).toBeTruthy();

    // Now flip to a near-expiry date: training_program + (today - 1y + 5d)
    // → expires in 5 days.
    const nearTrainingDate = (() => {
      const trainingDate = new Date(utcToday);
      trainingDate.setUTCFullYear(trainingDate.getUTCFullYear() - 1);
      trainingDate.setUTCDate(trainingDate.getUTCDate() + 5);
      return addDaysIso(trainingDate, 0);
    })();
    await user.clear(dateInput);
    await user.type(dateInput, nearTrainingDate);

    const warn = await within(dialog).findByTestId(
      "retraining-expiry-warning"
    );
    expect(warn.textContent).toMatch(/Expires in/i);
  });
});

describe("ContractorDetailDialog — recent values", () => {
  it("a value typed in one applicator dialog appears in the datalist on a different applicator", async () => {
    await db.applicators.bulkAdd([
      {
        id: "a-rv-1",
        organizationId: ORG,
        applicatorName: "First Applicator",
        contractorCompanyName: "Original Co",
        createdAt: new Date().toISOString(),
      },
      {
        id: "a-rv-2",
        organizationId: ORG,
        applicatorName: "Second Applicator",
        contractorCompanyName: "Second Co",
        createdAt: new Date().toISOString(),
      },
    ]);
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    // Open the first applicator, type a new company value, blur to commit it
    // to the recent-values LRU, then cancel out.
    await user.click(await screen.findByTestId("contractor-row-button-a-rv-1"));
    const dialog1 = await screen.findByTestId("contractor-detail-dialog");
    const companyField = within(dialog1).getByLabelText("Contractor company");
    await user.clear(companyField);
    await user.type(companyField, "Distinct Recent Co");
    // Tab to the next field to fire onBlur.
    await user.tab();
    await user.click(within(dialog1).getByRole("button", { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("contractor-detail-dialog")).toBeNull();
    });

    // Open the second (different) applicator. The datalist for the company
    // field should now include the value typed earlier.
    await user.click(await screen.findByTestId("contractor-row-button-a-rv-2"));
    const dialog2 = await screen.findByTestId("contractor-detail-dialog");

    const datalist = dialog2.ownerDocument.getElementById(
      "recent-contractor.company"
    );
    expect(datalist).toBeTruthy();
    const optionValues = Array.from(
      datalist?.querySelectorAll("option") ?? []
    ).map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).toContain("Distinct Recent Co");
  });
});
