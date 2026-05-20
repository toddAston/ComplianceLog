import type { Product } from "../domain/types";
import {
  inMemoryCatalogSource,
  type CatalogSource,
} from "./catalogLoader";

// Hand-curated Missouri row-crop product seed for v0.1. Registration numbers
// reflect the public APPRIL dataset at the catalogVersion date below; verify
// each row against APPRIL before promoting beyond the v0.1 MVP.
export const MO_SEED_CATALOG_VERSION = "MO-SEED-2026-05-19";

const SEED_CREATED_AT = "2026-05-19T00:00:00.000Z";

type SeedEntry = {
  id: string;
  name: string;
  epaRegistrationNumber: string;
  rupStatus: Product["rupStatus"];
};

const SEED_ENTRIES: ReadonlyArray<SeedEntry> = [
  { id: "mo-seed-roundup-powermax-3", name: "Roundup PowerMAX 3", epaRegistrationNumber: "524-475", rupStatus: "no" },
  { id: "mo-seed-liberty-280-sl", name: "Liberty 280 SL", epaRegistrationNumber: "264-829", rupStatus: "no" },
  { id: "mo-seed-enlist-one", name: "Enlist One", epaRegistrationNumber: "62719-695", rupStatus: "no" },
  { id: "mo-seed-enlist-duo", name: "Enlist Duo", epaRegistrationNumber: "62719-649", rupStatus: "no" },
  { id: "mo-seed-xtendimax-vaporgrip", name: "XtendiMax with VaporGrip Technology", epaRegistrationNumber: "524-617", rupStatus: "yes" },
  { id: "mo-seed-engenia", name: "Engenia", epaRegistrationNumber: "7969-345", rupStatus: "yes" },
  { id: "mo-seed-tavium-vaporgrip", name: "Tavium Plus VaporGrip Technology", epaRegistrationNumber: "100-1623", rupStatus: "yes" },
  { id: "mo-seed-dual-ii-magnum", name: "Dual II Magnum", epaRegistrationNumber: "100-818", rupStatus: "no" },
  { id: "mo-seed-harness", name: "Harness", epaRegistrationNumber: "524-454", rupStatus: "no" },
  { id: "mo-seed-warrant", name: "Warrant", epaRegistrationNumber: "524-591", rupStatus: "no" },
  { id: "mo-seed-zidua-sc", name: "Zidua SC", epaRegistrationNumber: "7969-338", rupStatus: "no" },
  { id: "mo-seed-authority-mtz", name: "Authority MTZ", epaRegistrationNumber: "279-3493", rupStatus: "no" },
  { id: "mo-seed-fierce", name: "Fierce", epaRegistrationNumber: "59639-153", rupStatus: "no" },
  { id: "mo-seed-valor-sx", name: "Valor SX", epaRegistrationNumber: "59639-99", rupStatus: "no" },
  { id: "mo-seed-flexstar", name: "Flexstar", epaRegistrationNumber: "100-1208", rupStatus: "no" },
  { id: "mo-seed-select-max", name: "Select Max", epaRegistrationNumber: "59639-119", rupStatus: "no" },
  { id: "mo-seed-cobra", name: "Cobra", epaRegistrationNumber: "10163-261", rupStatus: "no" },
  { id: "mo-seed-blazer", name: "Blazer", epaRegistrationNumber: "51036-289", rupStatus: "no" },
  { id: "mo-seed-poast", name: "Poast", epaRegistrationNumber: "7969-58", rupStatus: "no" },
  { id: "mo-seed-assure-ii", name: "Assure II", epaRegistrationNumber: "352-541", rupStatus: "no" },
  { id: "mo-seed-bicep-ii-magnum", name: "Bicep II Magnum", epaRegistrationNumber: "100-817", rupStatus: "no" },
  { id: "mo-seed-lumax-ez", name: "Lumax EZ", epaRegistrationNumber: "100-1442", rupStatus: "no" },
  { id: "mo-seed-halex-gt", name: "Halex GT", epaRegistrationNumber: "100-1305", rupStatus: "no" },
  { id: "mo-seed-callisto", name: "Callisto", epaRegistrationNumber: "100-1131", rupStatus: "no" },
  { id: "mo-seed-atrazine-4l", name: "Atrazine 4L", epaRegistrationNumber: "66222-32", rupStatus: "no" },
  { id: "mo-seed-gramoxone-sl-30", name: "Gramoxone SL 3.0", epaRegistrationNumber: "100-1431", rupStatus: "yes" },
  { id: "mo-seed-counter-20g", name: "Counter 20G", epaRegistrationNumber: "100-1115", rupStatus: "yes" },
  { id: "mo-seed-lorsban-advanced", name: "Lorsban Advanced", epaRegistrationNumber: "62719-591", rupStatus: "yes" },
  { id: "mo-seed-headline-amp", name: "Headline AMP", epaRegistrationNumber: "7969-251", rupStatus: "no" },
  { id: "mo-seed-quadris", name: "Quadris", epaRegistrationNumber: "100-1098", rupStatus: "no" },
];

export const moSeedProducts: ReadonlyArray<Product> = SEED_ENTRIES.map(
  (entry) => ({
    id: entry.id,
    catalogVersion: MO_SEED_CATALOG_VERSION,
    name: entry.name,
    epaRegistrationNumber: entry.epaRegistrationNumber,
    rupStatus: entry.rupStatus,
    createdAt: SEED_CREATED_AT,
  })
);

export const moSeedCatalogSource: CatalogSource = inMemoryCatalogSource(
  MO_SEED_CATALOG_VERSION,
  moSeedProducts
);
