import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import {
  MO_SEED_CATALOG_VERSION,
  moSeedProducts,
} from "./moSeedProducts";
import { seedMoCatalog } from "./seedMoCatalog";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("seedMoCatalog", () => {
  it("populates Dexie with every curated MO seed product", async () => {
    const result = await seedMoCatalog();

    expect(result.alreadyLoaded).toBe(false);
    expect(result.loaded).toBe(moSeedProducts.length);
    expect(await db.products.count()).toBe(moSeedProducts.length);

    const fromDb = await db.products
      .where("catalogVersion")
      .equals(MO_SEED_CATALOG_VERSION)
      .toArray();
    expect(fromDb.length).toBe(moSeedProducts.length);
  });

  it("is a no-op when called twice", async () => {
    await seedMoCatalog();
    const second = await seedMoCatalog();

    expect(second.alreadyLoaded).toBe(true);
    expect(second.loaded).toBe(0);
    expect(await db.products.count()).toBe(moSeedProducts.length);
  });

  it("does not clobber an unrelated catalog version already in the table", async () => {
    await db.products.put({
      id: "external-product",
      catalogVersion: "EXTERNAL-V1",
      name: "External Demo Product",
      epaRegistrationNumber: "99999-1",
      rupStatus: "no",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await seedMoCatalog();

    expect(await db.products.count()).toBe(moSeedProducts.length + 1);
    expect(await db.products.get("external-product")).toBeDefined();
  });
});
