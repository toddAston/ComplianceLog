import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import type { Product } from "../domain/types";
import {
  inMemoryCatalogSource,
  loadCatalog,
  type CatalogSource,
} from "./catalogLoader";

const now = () => new Date().toISOString();

const seedProducts = (catalogVersion: string): Product[] => [
  {
    id: "p-100-1431",
    catalogVersion,
    name: "GRAMOXONE SL 3.0",
    epaRegistrationNumber: "100-1431",
    rupStatus: "yes",
    createdAt: now(),
  },
  {
    id: "p-524-475",
    catalogVersion,
    name: "ROUNDUP POWERMAX 3",
    epaRegistrationNumber: "524-475",
    rupStatus: "no",
    createdAt: now(),
  },
];

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("loadCatalog", () => {
  it("loads products from a CatalogSource into Dexie", async () => {
    const source = inMemoryCatalogSource(
      "MO-SEED-2026-05-19",
      seedProducts("MO-SEED-2026-05-19")
    );

    const result = await loadCatalog(db, source);

    expect(result.loaded).toBe(2);
    expect(result.alreadyLoaded).toBe(false);
    expect(await db.products.count()).toBe(2);
  });

  it("is idempotent — calling twice does not double-insert", async () => {
    const source = inMemoryCatalogSource(
      "MO-SEED-2026-05-19",
      seedProducts("MO-SEED-2026-05-19")
    );

    await loadCatalog(db, source);
    const second = await loadCatalog(db, source);

    expect(second.loaded).toBe(0);
    expect(second.alreadyLoaded).toBe(true);
    expect(await db.products.count()).toBe(2);
  });

  it("does not refetch when a row with the same catalogVersion already exists", async () => {
    let fetchCount = 0;
    const source: CatalogSource = {
      catalogVersion: "MO-SEED-2026-05-19",
      async fetchProducts() {
        fetchCount += 1;
        return seedProducts("MO-SEED-2026-05-19");
      },
    };
    await loadCatalog(db, source);
    expect(fetchCount).toBe(1);

    await loadCatalog(db, source);
    expect(fetchCount).toBe(1);
  });

  it("returns loaded=0 when the source yields no products", async () => {
    const source = inMemoryCatalogSource("EMPTY-V1", []);

    const result = await loadCatalog(db, source);

    expect(result.loaded).toBe(0);
    expect(result.alreadyLoaded).toBe(false);
    expect(await db.products.count()).toBe(0);
  });

  it("rejects sources whose products carry a different catalogVersion", async () => {
    const source: CatalogSource = {
      catalogVersion: "MO-SEED-2026-05-19",
      async fetchProducts() {
        return [
          {
            id: "p-1",
            catalogVersion: "OTHER-VERSION",
            name: "Wrong Version",
            epaRegistrationNumber: "1-1",
            rupStatus: "no",
            createdAt: now(),
          },
        ];
      },
    };

    await expect(loadCatalog(db, source)).rejects.toThrow(
      /different catalogVersion/
    );
    expect(await db.products.count()).toBe(0);
  });

  it("can hold two distinct catalog versions side-by-side", async () => {
    await loadCatalog(
      db,
      inMemoryCatalogSource("V1", seedProducts("V1"))
    );

    const result = await loadCatalog(
      db,
      inMemoryCatalogSource("V2", [
        {
          id: "p-other",
          catalogVersion: "V2",
          name: "OTHER",
          epaRegistrationNumber: "9-9",
          rupStatus: "no",
          createdAt: now(),
        },
      ])
    );

    expect(result.loaded).toBe(1);
    expect(await db.products.count()).toBe(3);
    expect(
      await db.products.where("catalogVersion").equals("V1").count()
    ).toBe(2);
    expect(
      await db.products.where("catalogVersion").equals("V2").count()
    ).toBe(1);
  });
});

describe("inMemoryCatalogSource", () => {
  it("returns a defensive copy of the products array", async () => {
    const products = seedProducts("V1");
    const source = inMemoryCatalogSource("V1", products);

    const fetched = await source.fetchProducts();
    fetched.pop();

    expect(products.length).toBe(2);
  });
});
