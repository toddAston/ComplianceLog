import type { FieldLogDb } from "../db/fieldlogDb";
import type { Product } from "../domain/types";

export interface CatalogSource {
  catalogVersion: string;
  fetchProducts(): Promise<Product[]>;
}

export type CatalogLoadResult = {
  catalogVersion: string;
  loaded: number;
  alreadyLoaded: boolean;
};

export function inMemoryCatalogSource(
  catalogVersion: string,
  products: ReadonlyArray<Product>
): CatalogSource {
  return {
    catalogVersion,
    async fetchProducts() {
      return products.slice();
    },
  };
}

export async function loadCatalog(
  db: Pick<FieldLogDb, "products">,
  source: CatalogSource
): Promise<CatalogLoadResult> {
  const existing = await db.products
    .where("catalogVersion")
    .equals(source.catalogVersion)
    .count();
  if (existing > 0) {
    return {
      catalogVersion: source.catalogVersion,
      loaded: 0,
      alreadyLoaded: true,
    };
  }

  const products = await source.fetchProducts();

  const mismatched = products.filter(
    (p) => p.catalogVersion !== source.catalogVersion
  );
  if (mismatched.length > 0) {
    throw new Error(
      `CatalogSource "${source.catalogVersion}" returned ${mismatched.length} product(s) with a different catalogVersion`
    );
  }

  if (products.length > 0) {
    await db.products.bulkPut(products as Product[]);
  }

  return {
    catalogVersion: source.catalogVersion,
    loaded: products.length,
    alreadyLoaded: false,
  };
}
