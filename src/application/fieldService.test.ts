import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import { createFarm } from "./farmService";
import { createField, renameField, updateField } from "./fieldService";

const ORG = "org-test";

async function seedFarm(name = "North") {
  return createFarm({ organizationId: ORG, name });
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("createField", () => {
  it("creates a field tied to its farm and organization", async () => {
    const farm = await seedFarm();
    const field = await createField({
      organizationId: ORG,
      farmId: farm.id,
      name: " Field 7 ",
      defaultAcres: 42.5,
      defaultCropOrSite: " Soybeans ",
    });

    expect(field.name).toBe("Field 7");
    expect(field.farmId).toBe(farm.id);
    expect(field.organizationId).toBe(ORG);
    expect(field.defaultAcres).toBe(42.5);
    expect(field.defaultCropOrSite).toBe("Soybeans");
    expect(await db.fields.count()).toBe(1);
  });

  it("rejects an empty name", async () => {
    const farm = await seedFarm();
    await expect(
      createField({ organizationId: ORG, farmId: farm.id, name: "  " })
    ).rejects.toThrow(/required/);
  });

  it("rejects negative acres", async () => {
    const farm = await seedFarm();
    await expect(
      createField({
        organizationId: ORG,
        farmId: farm.id,
        name: "F",
        defaultAcres: -1,
      })
    ).rejects.toThrow(/negative/);
  });

  it("rejects an unknown farm", async () => {
    await expect(
      createField({ organizationId: ORG, farmId: "missing", name: "F" })
    ).rejects.toThrow(/Farm not found/);
  });

  it("rejects when the farm belongs to a different organization", async () => {
    const farm = await seedFarm();
    await expect(
      createField({ organizationId: "other-org", farmId: farm.id, name: "F" })
    ).rejects.toThrow(/active organization/);
  });

  it("rejects duplicate field names on the same farm (case-insensitive)", async () => {
    const farm = await seedFarm();
    await createField({ organizationId: ORG, farmId: farm.id, name: "Field 7" });
    await expect(
      createField({
        organizationId: ORG,
        farmId: farm.id,
        name: "  field 7  ",
      })
    ).rejects.toThrow(/already exists/);
    expect(await db.fields.count()).toBe(1);
  });

  it("permits identical field names on different farms", async () => {
    const a = await seedFarm("North");
    const b = await seedFarm("South");
    await createField({ organizationId: ORG, farmId: a.id, name: "F1" });
    await createField({ organizationId: ORG, farmId: b.id, name: "F1" });
    expect(await db.fields.count()).toBe(2);
  });

  it("treats an empty defaultCropOrSite as undefined", async () => {
    const farm = await seedFarm();
    const field = await createField({
      organizationId: ORG,
      farmId: farm.id,
      name: "F",
      defaultCropOrSite: "   ",
    });
    expect(field.defaultCropOrSite).toBeUndefined();
  });
});

describe("renameField", () => {
  it("renames a field and preserves the farmId/createdAt", async () => {
    const farm = await seedFarm();
    const field = await createField({
      organizationId: ORG,
      farmId: farm.id,
      name: "F1",
    });
    const renamed = await renameField(field.id, " New Name ");

    expect(renamed.id).toBe(field.id);
    expect(renamed.farmId).toBe(field.farmId);
    expect(renamed.createdAt).toBe(field.createdAt);
    expect(renamed.name).toBe("New Name");
  });

  it("rejects renaming to a sibling's name", async () => {
    const farm = await seedFarm();
    const a = await createField({
      organizationId: ORG,
      farmId: farm.id,
      name: "F1",
    });
    await createField({
      organizationId: ORG,
      farmId: farm.id,
      name: "F2",
    });
    await expect(renameField(a.id, "f2")).rejects.toThrow(/already exists/);
  });

  it("permits renaming to the same name as a field on a different farm", async () => {
    const a = await seedFarm("North");
    const b = await seedFarm("South");
    const aField = await createField({
      organizationId: ORG,
      farmId: a.id,
      name: "Original",
    });
    await createField({
      organizationId: ORG,
      farmId: b.id,
      name: "Sibling On Other Farm",
    });

    const renamed = await renameField(aField.id, "Sibling On Other Farm");
    expect(renamed.name).toBe("Sibling On Other Farm");
  });

  it("throws when the field does not exist", async () => {
    await expect(renameField("missing", "X")).rejects.toThrow(/not found/);
  });

  it("rejects an empty new name", async () => {
    const farm = await seedFarm();
    const field = await createField({
      organizationId: ORG,
      farmId: farm.id,
      name: "F",
    });
    await expect(renameField(field.id, "  ")).rejects.toThrow(/required/);
  });
});

describe("updateField", () => {
  async function seedField(extra: { defaultAcres?: number; crop?: string } = {}) {
    const farm = await seedFarm();
    return createField({
      organizationId: ORG,
      farmId: farm.id,
      name: "Original",
      defaultAcres: extra.defaultAcres,
      defaultCropOrSite: extra.crop,
    });
  }

  it("updates name, acres, and crop in a single call", async () => {
    const field = await seedField({ defaultAcres: 10, crop: "Corn" });
    const updated = await updateField(field.id, {
      name: " New Name ",
      defaultAcres: 25,
      defaultCropOrSite: " Soybeans ",
    });
    expect(updated.name).toBe("New Name");
    expect(updated.defaultAcres).toBe(25);
    expect(updated.defaultCropOrSite).toBe("Soybeans");
  });

  it("leaves untouched fields alone when patch omits them", async () => {
    const field = await seedField({ defaultAcres: 10, crop: "Corn" });
    const updated = await updateField(field.id, { name: "Just Name" });
    expect(updated.name).toBe("Just Name");
    expect(updated.defaultAcres).toBe(10);
    expect(updated.defaultCropOrSite).toBe("Corn");
  });

  it("clears defaultAcres when patched with null", async () => {
    const field = await seedField({ defaultAcres: 10 });
    const updated = await updateField(field.id, { defaultAcres: null });
    expect(updated.defaultAcres).toBeUndefined();
  });

  it("clears defaultCropOrSite when patched with null", async () => {
    const field = await seedField({ crop: "Corn" });
    const updated = await updateField(field.id, { defaultCropOrSite: null });
    expect(updated.defaultCropOrSite).toBeUndefined();
  });

  it("clears defaultCropOrSite when patched with whitespace-only", async () => {
    const field = await seedField({ crop: "Corn" });
    const updated = await updateField(field.id, { defaultCropOrSite: "   " });
    expect(updated.defaultCropOrSite).toBeUndefined();
  });

  it("rejects NaN acres", async () => {
    const field = await seedField();
    await expect(
      updateField(field.id, { defaultAcres: Number("lots") })
    ).rejects.toThrow(/must be a number/i);
  });

  it("rejects negative acres", async () => {
    const field = await seedField();
    await expect(
      updateField(field.id, { defaultAcres: -1 })
    ).rejects.toThrow(/negative/i);
  });

  it("rejects an empty trimmed name when name is in the patch", async () => {
    const field = await seedField();
    await expect(updateField(field.id, { name: "   " })).rejects.toThrow(
      /required/i
    );
  });

  it("rejects a collision with another field's name on the same farm", async () => {
    const farm = await seedFarm();
    await createField({
      organizationId: ORG,
      farmId: farm.id,
      name: "Taken",
    });
    const other = await createField({
      organizationId: ORG,
      farmId: farm.id,
      name: "Other",
    });
    await expect(updateField(other.id, { name: "taken" })).rejects.toThrow(
      /already exists/i
    );
  });

  it("throws when the field does not exist", async () => {
    await expect(updateField("missing", { name: "X" })).rejects.toThrow(
      /not found/i
    );
  });
});
