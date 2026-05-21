import type { Product } from "../domain/types";

// Curated Missouri-relevant Restricted Use Products sourced from EPA's RUP
// Summary Report (research/regulatory/markdown_conversions/rups-rpt_table.csv).
// All entries are RUP by definition. Selection focuses on row-crop (corn,
// soybean, cotton) and structural/termite applications common in southeast
// Missouri, plus a small rodenticide set so demos can exercise indoor /
// non-outdoor compliance paths.
//
// Catalog version matches the existing demo product so all seeded products
// share a single catalog generation. When this list updates, bump the version.
export const RUP_CATALOG_VERSION = "MO-DEMO-2026-05-19";

type RupSeed = {
  epaRegistrationNumber: string;
  name: string;
  manufacturer: string;
  activeIngredient: string;
};

const RUPS: RupSeed[] = [
  // ── Paraquat herbicides (cropland burndown) ─────────────────────────────────
  { epaRegistrationNumber: "100-1652", name: "Gramoxone 3LB", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Paraquat dichloride" },
  { epaRegistrationNumber: "5905-637", name: "Paraquat Concentrate", manufacturer: "Helena Agri-Enterprises, LLC", activeIngredient: "Paraquat dichloride" },
  { epaRegistrationNumber: "19713-617", name: "Drexel Quik-Quat", manufacturer: "Drexel Chemical Company", activeIngredient: "Paraquat dichloride" },
  { epaRegistrationNumber: "34704-1117", name: "LPI 6620 Paraquat 3SL", manufacturer: "Loveland Products, Inc.", activeIngredient: "Paraquat dichloride" },
  { epaRegistrationNumber: "74530-48", name: "Helmquat 3SL", manufacturer: "Helm Agro US, Inc.", activeIngredient: "Paraquat dichloride" },

  // ── Mixed-mode corn / soybean herbicides ────────────────────────────────────
  { epaRegistrationNumber: "100-1161", name: "Expert Herbicide", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Atrazine + Glyphosate IPA salt + S-Metolachlor" },
  { epaRegistrationNumber: "100-1359", name: "Callisto Xtra", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Mesotrione + Atrazine" },
  { epaRegistrationNumber: "100-1414", name: "Lexar EZ Herbicide", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Mesotrione + Atrazine + S-Metolachlor" },
  { epaRegistrationNumber: "228-530", name: "Manpower Herbicide", manufacturer: "Nufarm Americas, Inc.", activeIngredient: "2,4-D triisopropanolamine salt + Picloram triisopropanolamine salt" },
  { epaRegistrationNumber: "228-535", name: "Trooper 22K Herbicide", manufacturer: "Nufarm Americas, Inc.", activeIngredient: "Picloram potassium salt" },
  { epaRegistrationNumber: "228-586", name: "Trooper Extra Selective Herbicide", manufacturer: "Nufarm Americas, Inc.", activeIngredient: "Dicamba + 2,4-D triisopropanolamine salt + Picloram triisopropanolamine salt" },
  { epaRegistrationNumber: "53883-468", name: "CSI 19-313B Glufosinate 11.33%", manufacturer: "Control Solutions, Inc.", activeIngredient: "Glufosinate" },

  // ── Lambda-cyhalothrin insecticides (foliar) ────────────────────────────────
  { epaRegistrationNumber: "100-1086", name: "Karate EC-W Insecticide", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "lambda-Cyhalothrin" },
  { epaRegistrationNumber: "100-1088", name: "Scimitar GC Insecticide", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "lambda-Cyhalothrin" },
  { epaRegistrationNumber: "100-1097", name: "Karate Insecticide with Zeon", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "lambda-Cyhalothrin" },
  { epaRegistrationNumber: "100-1112", name: "Warrior Insecticide with Zeon", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "lambda-Cyhalothrin" },
  { epaRegistrationNumber: "100-1276", name: "Endigo ZC", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Thiamethoxam + lambda-Cyhalothrin" },

  // ── Tefluthrin (corn rootworm soil insecticide) ────────────────────────────
  { epaRegistrationNumber: "100-1075", name: "Force 3G Insecticide", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Tefluthrin" },
  { epaRegistrationNumber: "100-1253", name: "Force CS Insecticide", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Tefluthrin" },
  { epaRegistrationNumber: "100-1361", name: "Force SB", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Tefluthrin" },
  { epaRegistrationNumber: "100-1610", name: "Force Evo", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Tefluthrin" },
  { epaRegistrationNumber: "100-1615", name: "Force 10G HL Insecticide", manufacturer: "Syngenta Crop Protection, LLC", activeIngredient: "Tefluthrin" },

  // ── Bifenthrin (insecticide / miticide, also termiticide) ──────────────────
  { epaRegistrationNumber: "228-458", name: "Menace GC 7.9% Flowable", manufacturer: "Nufarm Americas, Inc.", activeIngredient: "Bifenthrin" },
  { epaRegistrationNumber: "228-524", name: "Menace GC 0.029% Plus Fertilizer", manufacturer: "Nufarm Americas, Inc.", activeIngredient: "Bifenthrin" },
  { epaRegistrationNumber: "279-3069", name: "Capture 2 EC Insecticide/Miticide", manufacturer: "FMC Corporation", activeIngredient: "Bifenthrin" },
  { epaRegistrationNumber: "279-3108", name: "Brigade WSB Insecticide/Miticide", manufacturer: "FMC Corporation", activeIngredient: "Bifenthrin" },
  { epaRegistrationNumber: "279-3115", name: "Biflex FT Termiticide", manufacturer: "FMC Corporation", activeIngredient: "Bifenthrin" },
  { epaRegistrationNumber: "53883-521", name: "CSI 22-422 Bifen plus Fipronil G", manufacturer: "Control Solutions, Inc.", activeIngredient: "Bifenthrin + Fipronil" },
  { epaRegistrationNumber: "53883-531", name: "CSI 22-442 Bifen Fipronil G", manufacturer: "Control Solutions, Inc.", activeIngredient: "Bifenthrin + Fipronil" },

  // ── Methomyl & aldicarb (carbamates) ───────────────────────────────────────
  { epaRegistrationNumber: "61842-52", name: "Lannate SP Insecticide", manufacturer: "Tessenderlo Kerley, Inc.", activeIngredient: "Methomyl" },
  { epaRegistrationNumber: "61842-55", name: "Lannate LV Insecticide", manufacturer: "Tessenderlo Kerley, Inc.", activeIngredient: "Methomyl" },
  { epaRegistrationNumber: "82557-2", name: "Methomyl 29 SL Insecticide", manufacturer: "Sinon USA, Inc.", activeIngredient: "Methomyl" },
  { epaRegistrationNumber: "87895-1", name: "Meymik 15G", manufacturer: "AgLogic Chemical, LLC", activeIngredient: "Aldicarb" },
  { epaRegistrationNumber: "87895-4", name: "AgLogic 15GG", manufacturer: "AgLogic Chemical, LLC", activeIngredient: "Aldicarb" },

  // ── Chlorpyrifos (heavily restricted, included for compliance variety) ────
  { epaRegistrationNumber: "19713-300", name: "Chlorpyrifos 4 Wood", manufacturer: "Drexel Chemical Company", activeIngredient: "Chlorpyrifos" },
  { epaRegistrationNumber: "19713-517", name: "Drexel Chlorpyrifos 4EC", manufacturer: "Drexel Chemical Company", activeIngredient: "Chlorpyrifos" },
  { epaRegistrationNumber: "19713-518", name: "Drexel Chlorpyrifos Concentrate", manufacturer: "Drexel Chemical Company", activeIngredient: "Chlorpyrifos" },

  // ── Diflubenzuron (insect growth regulator, cotton/forestry) ──────────────
  { epaRegistrationNumber: "34704-1103", name: "LPI Diflubenzuron 2L", manufacturer: "Loveland Products, Inc.", activeIngredient: "Diflubenzuron" },
  { epaRegistrationNumber: "53883-517", name: "MANA Diflubenzuron 2L", manufacturer: "Control Solutions, Inc.", activeIngredient: "Diflubenzuron" },
  { epaRegistrationNumber: "70506-386", name: "Diflumax 2L", manufacturer: "UPL NA, Inc.", activeIngredient: "Diflubenzuron" },

  // ── Zinc phosphide rodenticide (indoor/structural compliance path) ────────
  { epaRegistrationNumber: "4-152", name: "Bonide Orchard Mouse Bait", manufacturer: "Bonide Products, LLC", activeIngredient: "Zinc phosphide (Zn3P2)" },
  { epaRegistrationNumber: "814-9", name: "Force's Mous-Con No. 2", manufacturer: "Carajon Chemical Holdings, LLC", activeIngredient: "Zinc phosphide (Zn3P2)" },
  { epaRegistrationNumber: "4271-16", name: "Zinc Phosphide on Oats", manufacturer: "R & M Exterminators Inc", activeIngredient: "Zinc phosphide (Zn3P2)" },
];

// Stable id generator: rup-<epa-reg-with-dash-preserved-lowercased>. EPA reg
// numbers are unique by construction so the id stays stable across reseeds.
const idFor = (epa: string) => `rup-${epa.toLowerCase()}`;

export function buildRupProductSeed(timestamp: string): Product[] {
  return RUPS.map((r) => ({
    id: idFor(r.epaRegistrationNumber),
    catalogVersion: RUP_CATALOG_VERSION,
    name: r.name,
    epaRegistrationNumber: r.epaRegistrationNumber,
    rupStatus: "yes",
    createdAt: timestamp,
    activeIngredient: r.activeIngredient,
    manufacturer: r.manufacturer,
  }));
}
