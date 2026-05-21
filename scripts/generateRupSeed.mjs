// Reads the EPA RUP report CSV at research/regulatory/markdown_conversions/
// rups-rpt_table.csv and emits a typed TypeScript seed module containing the
// full curated catalog. We classify each row by active-ingredient family so
// the catalog tells a coherent demo story (insecticide vs herbicide vs
// rodenticide vs structural). Run with: node scripts/generateRupSeed.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(
  __dirname,
  "../research/regulatory/markdown_conversions/rups-rpt_table.csv"
);
const outPath = resolve(__dirname, "../src/db/seedRupProducts.ts");

// Minimal CSV parser that handles quoted fields with embedded commas / quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      // handle \r\n
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const raw = readFileSync(csvPath, "utf8");
const rows = parseCsv(raw);
const header = rows.shift();
const [REG, NAME, _CO_NUM, CO, ACTIVE, _PCT] = [0, 1, 2, 3, 4, 5];

// Classification heuristics, matched against the active ingredient string.
// Each family carries a default crop hint used to seed demo records later.
const FAMILIES = [
  { id: "insecticide_corn", label: "Soil insecticide (corn rootworm)", match: /tefluthrin|chlorethoxyfos|tebupirimphos|fonofos/i },
  { id: "insecticide_pyrethroid", label: "Pyrethroid foliar insecticide", match: /lambda-?cyhalothrin|gamma-?cyhalothrin|bifenthrin|deltamethrin|cyfluthrin|cypermethrin|permethrin|fenpropathrin|esfenvalerate|zeta-?cypermethrin/i },
  { id: "insecticide_carbamate", label: "Carbamate insecticide", match: /aldicarb|methomyl|carbofuran|oxamyl/i },
  { id: "insecticide_op", label: "Organophosphate insecticide", match: /chlorpyrifos|ethoprop|phorate|terbufos|dimethoate|naled|dichlorvos|ddvp|disulfoton|fenamiphos|profenofos/i },
  { id: "insecticide_misc", label: "Other restricted insecticide", match: /imidacloprid|thiamethoxam|abamectin|diflubenzuron|fipronil|methiocarb|fenoxycarb|pyriproxyfen/i },
  { id: "herbicide_burndown", label: "Burndown / contact herbicide", match: /paraquat|diquat/i },
  { id: "herbicide_corn_soy", label: "Corn / soybean herbicide", match: /atrazine|metolachlor|alachlor|isoxaflutole|mesotrione|nicosulfuron|topramezone|simazine|cyanazine|tembotrione/i },
  { id: "herbicide_range", label: "Rangeland / pasture herbicide", match: /picloram|2,?\s*4-?d|triclopyr|aminopyralid|clopyralid|dicamba|fluroxypyr/i },
  { id: "herbicide_glufosinate", label: "Glufosinate herbicide", match: /glufosinate/i },
  { id: "rodenticide", label: "Rodenticide (indoor / structural)", match: /zinc phosphide|strychnine|chlorophacinone|diphacinone|bromethalin|brodifacoum/i },
  { id: "fumigant", label: "Soil / structural fumigant", match: /methyl bromide|aluminum phosphide|magnesium phosphide|sulfuryl fluoride|metam-?sodium|metam-?potassium|chloropicrin|1,?\s*3-?dichloropropene|telone/i },
  { id: "fungicide", label: "Restricted fungicide / nematicide", match: /mancozeb|ziram|maneb|fenamiphos|methoxyfenozide/i },
  { id: "wood_preservative", label: "Wood preservative", match: /creosote|pentachlorophenol|cca|chromated|copper naphthenate/i },
];

const properCase = (s) =>
  s
    .toLowerCase()
    .replace(/(^|[\s/(\-])(\w)/g, (_, p1, p2) => p1 + p2.toUpperCase())
    .replace(/\bLlc\b/gi, "LLC")
    .replace(/\bInc\.?\b/gi, "Inc.")
    .replace(/\bInc\.\.\b/gi, "Inc.")
    .replace(/\bL\.L\.C\.\b/gi, "LLC")
    .replace(/\bL\.l\.c\.\b/gi, "LLC")
    .replace(/\bUsa\b/gi, "USA")
    .replace(/\bUs\b/gi, "US")
    .replace(/\bDba\b/gi, "d/b/a")
    .replace(/\bD\/b\/a\b/gi, "d/b/a");

const tidyName = (raw) => {
  let s = raw.trim();
  // Strip trademark/registered marks for cleaner picker display.
  s = s.replace(/[®™©]/g, "");
  // Product names are mixed case in the source — normalize obvious shouting.
  if (/^[A-Z0-9 ./()'%+&,!#\-]+$/.test(s) && /[A-Z]{4,}/.test(s)) {
    s = properCase(s);
  }
  // Common product suffixes/units: keep uppercase regardless of case routing.
  s = s
    .replace(/(\d+(?:\.\d+)?)\s*([a-z]{1,4})\b/gi, (_, num, unit) => {
      const u = unit.toUpperCase();
      // Only force-uppercase if the unit is one of the known agronomic short codes.
      if (/^(G|GR|EC|SC|SL|SP|WG|WP|WS|WSB|CS|FT|GC|LB|OZ|HL|EW|ME|DF|AS|F|L|SE|SG)$/i.test(unit)) {
        return `${num}${u}`;
      }
      return `${num}${unit}`;
    });
  // De-duplicate trailing punctuation runs like "Inc..".
  s = s.replace(/\.{2,}$/g, ".");
  return s;
};

const classify = (active) => {
  for (const fam of FAMILIES) {
    if (fam.match.test(active)) return fam;
  }
  return null;
};

// Bucket rows by family, drop unclassified.
const buckets = new Map();
for (const fam of FAMILIES) buckets.set(fam.id, []);
let unclassified = 0;
let parsed = 0;

for (const r of rows) {
  if (r.length < 5) continue;
  const reg = (r[REG] ?? "").trim();
  const name = (r[NAME] ?? "").trim();
  const company = (r[CO] ?? "").trim();
  const active = (r[ACTIVE] ?? "").trim();
  if (!reg || !name) continue;
  parsed += 1;
  const fam = classify(active);
  if (!fam) {
    unclassified += 1;
    continue;
  }
  buckets.get(fam.id).push({
    epaRegistrationNumber: reg,
    name: tidyName(name),
    // Manufacturer string sometimes ends in "Inc." in the source; properCase
    // adds a "." behind "Inc" — strip any resulting "Inc.." down to "Inc.".
    manufacturer: properCase(company).replace(/Inc\.{2,}/g, "Inc."),
    activeIngredient: active,
  });
}

// Cap each bucket at MAX_PER_FAMILY to keep the seed reasonable but rich.
// The 41-row pre-existing seed was tight; this lands at ~150-200.
const MAX_PER_FAMILY = 20;
const selected = [];
for (const fam of FAMILIES) {
  const rows = buckets.get(fam.id) ?? [];
  selected.push({ family: fam, rows: rows.slice(0, MAX_PER_FAMILY) });
}
const total = selected.reduce((sum, s) => sum + s.rows.length, 0);

// Render the seed module.
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

let out = `import type { Product } from "../domain/types";

// Curated Missouri-relevant Restricted Use Products sourced from EPA's RUP
// Summary Report (research/regulatory/markdown_conversions/rups-rpt_table.csv).
// All entries are RUP by definition. Auto-generated by scripts/generateRupSeed.mjs;
// edit the script, not this file. Selection bucketed by active-ingredient
// family with a per-family cap so the demo product picker tells a coherent
// story (insecticide / herbicide / rodenticide / fumigant) and exercises every
// path in the compliance engine — RUP_UNCERTIFIED, indoor exemption,
// structural/termite exception, etc.

export const RUP_CATALOG_VERSION = "MO-DEMO-2026-05-21";

export type RupFamily =
${FAMILIES.map((f) => `  | "${f.id}"`).join("\n")};

type RupSeed = {
  epaRegistrationNumber: string;
  name: string;
  manufacturer: string;
  activeIngredient: string;
  family: RupFamily;
};

// Total curated entries: ${total}. Generated ${new Date().toISOString().slice(0, 10)}.
const RUPS: RupSeed[] = [
`;

for (const { family, rows } of selected) {
  out += `\n  // ── ${family.label} (${rows.length}) ─────────────────────────────────\n`;
  for (const r of rows) {
    out += `  { epaRegistrationNumber: "${esc(r.epaRegistrationNumber)}", name: "${esc(r.name)}", manufacturer: "${esc(r.manufacturer)}", activeIngredient: "${esc(r.activeIngredient)}", family: "${family.id}" },\n`;
  }
}

out += `];

// Stable id generator: rup-<epa-reg-with-dash-preserved-lowercased>. EPA reg
// numbers are unique by construction so the id stays stable across reseeds.
const idFor = (epa: string) => \`rup-\${epa.toLowerCase()}\`;

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

// Per-family lookup so seeded demo records can pick a thematically-coherent
// product (e.g. a rodenticide for an indoor record, a fumigant for a
// structural one, a herbicide for an outdoor field record).
export function rupIdsByFamily(family: RupFamily): string[] {
  return RUPS.filter((r) => r.family === family).map((r) =>
    idFor(r.epaRegistrationNumber)
  );
}
`;

writeFileSync(outPath, out, "utf8");
console.log(
  `[generateRupSeed] parsed ${parsed} rows, classified ${total}, dropped ${unclassified} unclassified. Wrote ${outPath}.`
);
