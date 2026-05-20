import { describe, expect, it } from "vitest";
import { productSchema } from "../domain/schemas";
import {
  MO_SEED_CATALOG_VERSION,
  moSeedCatalogSource,
  moSeedProducts,
} from "./moSeedProducts";

describe("moSeedProducts", () => {
  it("contains at least 20 curated Missouri row-crop products", () => {
    expect(moSeedProducts.length).toBeGreaterThanOrEqual(20);
  });

  it("validates every entry against productSchema", () => {
    for (const product of moSeedProducts) {
      expect(() => productSchema.parse(product)).not.toThrow();
    }
  });

  it("tags every entry with the same catalogVersion", () => {
    for (const product of moSeedProducts) {
      expect(product.catalogVersion).toBe(MO_SEED_CATALOG_VERSION);
    }
  });

  it("has no duplicate product ids", () => {
    const ids = new Set(moSeedProducts.map((p) => p.id));
    expect(ids.size).toBe(moSeedProducts.length);
  });

  it("has no duplicate EPA registration numbers", () => {
    const regs = new Set(moSeedProducts.map((p) => p.epaRegistrationNumber));
    expect(regs.size).toBe(moSeedProducts.length);
  });

  it("includes both RUP and non-RUP products so the form UX is exercised", () => {
    const yes = moSeedProducts.filter((p) => p.rupStatus === "yes");
    const no = moSeedProducts.filter((p) => p.rupStatus === "no");
    expect(yes.length).toBeGreaterThan(0);
    expect(no.length).toBeGreaterThan(0);
  });
});

describe("moSeedCatalogSource", () => {
  it("exposes the same catalogVersion as the seed", async () => {
    expect(moSeedCatalogSource.catalogVersion).toBe(MO_SEED_CATALOG_VERSION);
    const fetched = await moSeedCatalogSource.fetchProducts();
    expect(fetched.length).toBe(moSeedProducts.length);
  });
});
