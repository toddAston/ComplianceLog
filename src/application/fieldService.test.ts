import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import { createFarm } from "./farmService";
import { createField, renameField } from "./fieldService";

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
