import { z } from "zod";

export const apprilRawRowSchema = z.object({
  reg_num: z.string().min(1),
  reg_type: z.string().optional(),
  product_name: z.string().min(1),
  status_group: z.string().optional(),
  rup_flag: z.string().optional(),
  rup_reason: z.string().optional(),
  signal_word: z.string().optional(),
  pesticide_type: z.string().optional(),
  pest_cat: z.string().optional(),
  sites: z.string().optional(),
  ais: z.string().optional(),
});
export type AppRilRawRow = z.infer<typeof apprilRawRowSchema>;

export const catalogProductSchema = z.object({
  epaRegistrationNumber: z.string(),
  name: z.string(),
  rupStatus: z.enum(["yes", "no", "unknown"]),
  rupReason: z.string().optional(),
  signalWord: z.string().optional(),
  pesticideType: z.string().optional(),
  pestCategories: z.array(z.string()),
  useSites: z.array(z.string()),
  activeIngredients: z.array(z.string()),
});
export type CatalogProduct = z.infer<typeof catalogProductSchema>;

export type IngestionOptions = {
  catalogVersion: string;
  activeOnly?: boolean;
  sec3Only?: boolean;
  siteIncludes?: ReadonlyArray<string>;
};

function splitClob(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function splitAis(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function mapRupFlag(value: string | undefined): CatalogProduct["rupStatus"] {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "Y" || v === "YES") return "yes";
  if (v === "N" || v === "NO") return "no";
  return "unknown";
}

export function isAcceptedRow(
  row: AppRilRawRow,
  options: IngestionOptions
): boolean {
  if (options.activeOnly && (row.status_group ?? "").toLowerCase() !== "active") {
    return false;
  }
  if (options.sec3Only && (row.reg_type ?? "") !== "Sec3") {
    return false;
  }
  if (options.siteIncludes && options.siteIncludes.length > 0) {
    const sites = (row.sites ?? "").toLowerCase();
    const matched = options.siteIncludes.some((needle) =>
      sites.includes(needle.toLowerCase())
    );
    if (!matched) return false;
  }
  return true;
}

export function projectAppRilRow(row: AppRilRawRow): CatalogProduct {
  return {
    epaRegistrationNumber: row.reg_num.trim(),
    name: row.product_name.trim(),
    rupStatus: mapRupFlag(row.rup_flag),
    rupReason: row.rup_reason?.trim() || undefined,
    signalWord: row.signal_word?.trim() || undefined,
    pesticideType: row.pesticide_type?.trim() || undefined,
    pestCategories: splitClob(row.pest_cat),
    useSites: splitClob(row.sites),
    activeIngredients: splitAis(row.ais),
  };
}

export function ingestAppRilRows(
  rawRows: ReadonlyArray<unknown>,
  options: IngestionOptions
): { catalogVersion: string; products: CatalogProduct[] } {
  const products: CatalogProduct[] = [];
  const seen = new Set<string>();

  for (const candidate of rawRows) {
    const parsed = apprilRawRowSchema.safeParse(candidate);
    if (!parsed.success) continue;
    if (!isAcceptedRow(parsed.data, options)) continue;
    const product = projectAppRilRow(parsed.data);
    if (seen.has(product.epaRegistrationNumber)) continue;
    seen.add(product.epaRegistrationNumber);
    products.push(product);
  }

  products.sort((a, b) =>
    a.epaRegistrationNumber < b.epaRegistrationNumber
      ? -1
      : a.epaRegistrationNumber > b.epaRegistrationNumber
        ? 1
        : 0
  );

  return { catalogVersion: options.catalogVersion, products };
}
