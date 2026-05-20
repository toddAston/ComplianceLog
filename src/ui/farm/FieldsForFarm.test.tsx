import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../../db/fieldlogDb";
import { FieldsForFarm } from "./FieldsForFarm";

const ORG = "org-test";
const FARM_ID = "farm-1";

async function seedFarm() {
  await db.farms.add({
    id: FARM_ID,
    organizationId: ORG,
    name: "North",
    createdAt: new Date().toISOString(),
  });
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedFarm();
});

afterEach(() => {
  cleanup();
});

describe("FieldsForFarm", () => {
  it("shows an empty-state alert when the farm has no fields", async () => {
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);
    expect(await screen.findByTestId(`fields-empty-${FARM_ID}`)).toBeTruthy();
  });

  it("creates a new field with name, acres, and crop, clearing the inputs", async () => {
    const user = userEvent.setup();
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    await user.type(
      screen.getByLabelText(`New field name for farm ${FARM_ID}`),
      "Field 7"
    );
    await user.type(
      screen.getByLabelText(`Acres for new field on farm ${FARM_ID}`),
      "42.5"
    );
    await user.type(
      screen.getByLabelText(`Crop for new field on farm ${FARM_ID}`),
      "Soybeans"
    );
    await user.click(screen.getByRole("button", { name: /add field/i }));

    await waitFor(async () => expect(await db.fields.count()).toBe(1));
    const [field] = await db.fields.toArray();
    expect(field.name).toBe("Field 7");
    expect(field.defaultAcres).toBe(42.5);
    expect(field.defaultCropOrSite).toBe("Soybeans");

    expect(
      (
        screen.getByLabelText(
          `New field name for farm ${FARM_ID}`
        ) as HTMLInputElement
      ).value
    ).toBe("");
  });

  it("rejects non-numeric acres with an inline error", async () => {
    const user = userEvent.setup();
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    await user.type(
      screen.getByLabelText(`New field name for farm ${FARM_ID}`),
      "F"
    );
    await user.type(
      screen.getByLabelText(`Acres for new field on farm ${FARM_ID}`),
      "lots"
    );
    await user.click(screen.getByRole("button", { name: /add field/i }));

    expect(await screen.findByText(/must be a number/i)).toBeTruthy();
    expect(await db.fields.count()).toBe(0);
  });

  it("surfaces duplicate-name errors inline", async () => {
    const user = userEvent.setup();
    await db.fields.add({
      id: "f-1",
      organizationId: ORG,
      farmId: FARM_ID,
      name: "Field 7",
      createdAt: new Date().toISOString(),
    });
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    await user.type(
      screen.getByLabelText(`New field name for farm ${FARM_ID}`),
      "field 7"
    );
    await user.click(screen.getByRole("button", { name: /add field/i }));

    expect(await screen.findByText(/already exists/i)).toBeTruthy();
    expect(await db.fields.count()).toBe(1);
  });

  it("only lists fields for its own farm", async () => {
    await db.farms.add({
      id: "farm-other",
      organizationId: ORG,
      name: "South",
      createdAt: new Date().toISOString(),
    });
    await db.fields.bulkAdd([
      {
        id: "f-mine",
        organizationId: ORG,
        farmId: FARM_ID,
        name: "Mine",
        createdAt: new Date().toISOString(),
      },
      {
        id: "f-other",
        organizationId: ORG,
        farmId: "farm-other",
        name: "Theirs",
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    expect(await screen.findByText(/Mine/)).toBeTruthy();
    expect(screen.queryByText("Theirs")).toBeNull();
  });

  it("hides the field picker when the farm has no fields", async () => {
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);
    await screen.findByTestId(`fields-empty-${FARM_ID}`);
    expect(screen.queryByTestId(`field-picker-${FARM_ID}`)).toBeNull();
  });

  it("shows the field picker when at least one field exists", async () => {
    await db.fields.bulkAdd([
      {
        id: "f-1",
        organizationId: ORG,
        farmId: FARM_ID,
        name: "Alpha",
        createdAt: new Date().toISOString(),
      },
      {
        id: "f-2",
        organizationId: ORG,
        farmId: FARM_ID,
        name: "Bravo",
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    const picker = await screen.findByLabelText("Pick a field to edit");
    await userEvent.setup().click(picker);
    expect(await screen.findByRole("option", { name: "Alpha" })).toBeTruthy();
    expect(await screen.findByRole("option", { name: "Bravo" })).toBeTruthy();
  });

  it("picker pre-populates acres and crop and saves all three columns", async () => {
    const user = userEvent.setup();
    await db.fields.add({
      id: "f-1",
      organizationId: ORG,
      farmId: FARM_ID,
      name: "Existing",
      defaultAcres: 12.5,
      defaultCropOrSite: "Corn",
      createdAt: new Date().toISOString(),
    });
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    await user.click(await screen.findByLabelText("Pick a field to edit"));
    await user.click(await screen.findByRole("option", { name: "Existing" }));

    expect(
      (
        screen.getByLabelText(`Edit acres for Existing`) as HTMLInputElement
      ).value
    ).toBe("12.5");
    expect(
      (
        screen.getByLabelText(`Edit crop for Existing`) as HTMLInputElement
      ).value
    ).toBe("Corn");

    await user.clear(screen.getByLabelText(`Edit acres for Existing`));
    await user.type(screen.getByLabelText(`Edit acres for Existing`), "40");
    await user.clear(screen.getByLabelText(`Edit crop for Existing`));
    await user.type(screen.getByLabelText(`Edit crop for Existing`), "Wheat");
    await user.click(screen.getByRole("button", { name: /save/i }));

    const updated = await db.fields.get("f-1");
    expect(updated?.defaultAcres).toBe(40);
    expect(updated?.defaultCropOrSite).toBe("Wheat");
    expect(updated?.name).toBe("Existing");
  });

  it("clears acres and crop when the editor inputs are emptied", async () => {
    const user = userEvent.setup();
    await db.fields.add({
      id: "f-1",
      organizationId: ORG,
      farmId: FARM_ID,
      name: "ToBareName",
      defaultAcres: 15,
      defaultCropOrSite: "Cotton",
      createdAt: new Date().toISOString(),
    });
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    await user.click(await screen.findByRole("button", { name: /^edit$/i }));
    await user.clear(screen.getByLabelText(`Edit acres for ToBareName`));
    await user.clear(screen.getByLabelText(`Edit crop for ToBareName`));
    await user.click(screen.getByRole("button", { name: /save/i }));

    const updated = await db.fields.get("f-1");
    expect(updated?.defaultAcres).toBeUndefined();
    expect(updated?.defaultCropOrSite).toBeUndefined();
  });

  it("surfaces a 'must be a number' error when editor acres is non-numeric", async () => {
    const user = userEvent.setup();
    await db.fields.add({
      id: "f-1",
      organizationId: ORG,
      farmId: FARM_ID,
      name: "Numeric",
      createdAt: new Date().toISOString(),
    });
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    await user.click(await screen.findByRole("button", { name: /^edit$/i }));
    await user.type(screen.getByLabelText(`Edit acres for Numeric`), "lots");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/must be a number/i)).toBeTruthy();
  });

  it("picking a field via the picker opens its inline editor and edits the name", async () => {
    const user = userEvent.setup();
    await db.fields.add({
      id: "f-1",
      organizationId: ORG,
      farmId: FARM_ID,
      name: "Pickable",
      createdAt: new Date().toISOString(),
    });
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    await user.click(await screen.findByLabelText("Pick a field to edit"));
    await user.click(await screen.findByRole("option", { name: "Pickable" }));

    const input = await screen.findByLabelText("Edit Pickable");
    await user.clear(input);
    await user.type(input, "Picked & Renamed");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Picked & Renamed")).toBeTruthy();
    expect((await db.fields.get("f-1"))?.name).toBe("Picked & Renamed");
  });

  it("exposes an Edit affordance (not Rename) on field rows", async () => {
    await db.fields.add({
      id: "f-1",
      organizationId: ORG,
      farmId: FARM_ID,
      name: "Old",
      createdAt: new Date().toISOString(),
    });
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    expect(
      await screen.findByRole("button", { name: /^edit$/i })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^rename$/i })).toBeNull();
  });

  it("renames an existing field via the inline editor", async () => {
    const user = userEvent.setup();
    await db.fields.add({
      id: "f-1",
      organizationId: ORG,
      farmId: FARM_ID,
      name: "Old",
      createdAt: new Date().toISOString(),
    });
    render(<FieldsForFarm organizationId={ORG} farmId={FARM_ID} />);

    await user.click(await screen.findByRole("button", { name: /^edit$/i }));
    const input = await screen.findByLabelText("Edit Old");
    await user.clear(input);
    await user.type(input, "New Name");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/New Name/)).toBeTruthy();
    expect((await db.fields.get("f-1"))?.name).toBe("New Name");
  });
});
