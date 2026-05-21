import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./fieldlogDb";
import { DEMO_ORG_ID, seedDemoData } from "./seed";
import { buildRupProductSeed, RUP_CATALOG_VERSION } from "./seedRupProducts";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("buildRupProductSeed", () => {
  it("returns at least 40 curated RUP products", () => {
    const products = buildRupProductSeed(new Date().toISOString());
    expect(products.length).toBeGreaterThanOrEqual(40);
  });

  it("every entry is marked rupStatus 'yes' and carries an EPA reg number", () => {
    const products = buildRupProductSeed(new Date().toISOString());
    for (const p of products) {
      expect(p.rupStatus).toBe("yes");
      expect(p.epaRegistrationNumber.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it("EPA registration numbers and ids are unique across the curated set", () => {
    const products = buildRupProductSeed(new Date().toISOString());
    const epas = products.map((p) => p.epaRegistrationNumber);
    const ids = products.map((p) => p.id);
    expect(new Set(epas).size).toBe(epas.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all entries share the same catalog version", () => {
    const products = buildRupProductSeed(new Date().toISOString());
    for (const p of products) {
      expect(p.catalogVersion).toBe(RUP_CATALOG_VERSION);
    }
  });

  it("entries carry an active ingredient and a manufacturer", () => {
    const products = buildRupProductSeed(new Date().toISOString());
    for (const p of products) {
      expect(p.activeIngredient?.length ?? 0).toBeGreaterThan(0);
      expect(p.manufacturer?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("seedDemoData with RUP catalog", () => {
  it("loads the existing demo product plus the curated RUP catalog into Dexie", async () => {
    await seedDemoData();
    const products = await db.products.toArray();

    // demo product + curated RUPs
    expect(products.length).toBeGreaterThan(40);
    expect(products.find((p) => p.id === "product-example-herbicide-4l")).toBeDefined();
    // Spot-check a few well-known products from the curated list.
    expect(products.find((p) => p.epaRegistrationNumber === "100-1075")?.name).toMatch(/Force 3G/i);
    expect(products.find((p) => p.epaRegistrationNumber === "100-1652")?.name).toMatch(/Gramoxone/i);
    expect(products.find((p) => p.epaRegistrationNumber === "61842-52")?.name).toMatch(/Lannate/i);
  });

  it("is idempotent — seeding twice does not duplicate the curated products", async () => {
    await seedDemoData();
    const firstCount = (await db.products.toArray()).length;
    await seedDemoData();
    const secondCount = (await db.products.toArray()).length;
    expect(secondCount).toBe(firstCount);
  });

  it("the org row stays unique after a second seed call", async () => {
    await seedDemoData();
    await seedDemoData();
    const orgs = await db.organizations.toArray();
    expect(orgs.length).toBe(1);
    expect(orgs[0].id).toBe(DEMO_ORG_ID);
  });
});
