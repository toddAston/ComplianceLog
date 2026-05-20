import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import { createFarm, renameFarm } from "./farmService";

const ORG = "org-test";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("createFarm", () => {
  it("creates a farm with trimmed name and a stable id", async () => {
    const farm = await createFarm({ organizationId: ORG, name: "  North Farm  " });

    expect(farm.id).toMatch(/^[0-9a-f-]+$/i);
    expect(farm.name).toBe("North Farm");
    expect(farm.organizationId).toBe(ORG);
    expect(typeof farm.createdAt).toBe("string");
    expect(await db.farms.count()).toBe(1);
  });

  it("rejects an empty or whitespace-only name", async () => {
    await expect(
      createFarm({ organizationId: ORG, name: "   " })
    ).rejects.toThrow(/Farm name/);
    expect(await db.farms.count()).toBe(0);
  });

  it("rejects a missing organizationId", async () => {
    await expect(
      createFarm({ organizationId: "", name: "Anything" })
    ).rejects.toThrow(/organizationId/);
  });

  it("rejects a duplicate farm name within the same org (case-insensitive)", async () => {
    await createFarm({ organizationId: ORG, name: "North" });
    await expect(
      createFarm({ organizationId: ORG, name: "  north  " })
    ).rejects.toThrow(/already exists/);
    expect(await db.farms.count()).toBe(1);
  });

  it("permits the same farm name in a different organization", async () => {
    await createFarm({ organizationId: ORG, name: "North" });
    const other = await createFarm({
      organizationId: "org-other",
      name: "North",
    });
    expect(other.organizationId).toBe("org-other");
    expect(await db.farms.count()).toBe(2);
  });
});

describe("renameFarm", () => {
  it("updates the name and preserves id + createdAt", async () => {
    const farm = await createFarm({ organizationId: ORG, name: "North" });
    const renamed = await renameFarm(farm.id, " North Farm ");

    expect(renamed.id).toBe(farm.id);
    expect(renamed.createdAt).toBe(farm.createdAt);
    expect(renamed.name).toBe("North Farm");
  });

  it("throws when the farm does not exist", async () => {
    await expect(renameFarm("nope", "X")).rejects.toThrow(/not found/);
  });

  it("rejects an empty new name", async () => {
    const farm = await createFarm({ organizationId: ORG, name: "North" });
    await expect(renameFarm(farm.id, "  ")).rejects.toThrow(/required/);
  });

  it("rejects renaming to a sibling's name in the same org", async () => {
    const a = await createFarm({ organizationId: ORG, name: "North" });
    await createFarm({ organizationId: ORG, name: "South" });
    await expect(renameFarm(a.id, "south")).rejects.toThrow(/already exists/);
  });

  it("allows renaming to the same name (no-op when uppercase changes)", async () => {
    const farm = await createFarm({ organizationId: ORG, name: "North Farm" });
    const renamed = await renameFarm(farm.id, "NORTH FARM");
    expect(renamed.name).toBe("NORTH FARM");
  });
});
