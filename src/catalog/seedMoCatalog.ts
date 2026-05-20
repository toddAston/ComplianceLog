import { db } from "../db/fieldlogDb";
import { loadCatalog, type CatalogLoadResult } from "./catalogLoader";
import { moSeedCatalogSource } from "./moSeedProducts";

export async function seedMoCatalog(): Promise<CatalogLoadResult> {
  return loadCatalog(db, moSeedCatalogSource);
}
