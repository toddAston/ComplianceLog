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

    await user.click(await screen.findByRole("button", { name: /rename/i }));
    const input = await screen.findByLabelText("Rename Old");
    await user.clear(input);
    await user.type(input, "New Name");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/New Name/)).toBeTruthy();
    expect((await db.fields.get("f-1"))?.name).toBe("New Name");
  });
});
