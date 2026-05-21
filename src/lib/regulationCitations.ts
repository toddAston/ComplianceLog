// Registry mapping every `citationShort` the compliance engine can emit to
// either a page-number jump in the in-app regulation PDF, or an "external /
// internal" marker meaning the chip is non-clickable.
//
// The PDF lives at `/missouri-2-csr-70-25.pdf` (Vite serves it from public/).
// Browsers support the `#page=N` fragment natively (Chrome / Edge / Firefox /
// Safari) so RegulationDialog just sets the iframe `src` accordingly. We do
// NOT use `#search=...` — `page=N` is universally honored; search varies by
// browser, and the user picked "page-only" for consistency.

export type CitationDestination =
  | { kind: "pdf"; page: number; sectionTitle: string }
  | { kind: "external"; sectionTitle: string }
  | { kind: "internal"; sectionTitle: string };

// Page numbers reflect the compiled regulation PDF at
// research/regulatory/missouri_2_csr_70_25_pesticides_compiled.pdf
// (the same file shipped at public/missouri-2-csr-70-25.pdf). Numbers come
// from the PDF's printed page footer, not the PDF's zero-indexed page count
// — Vite serves the file unchanged and browsers honor `#page=N` against
// printed page numbers when present.
const CITATION_REGISTRY: Record<string, CitationDestination> = {
  // §.010 Definitions — direct supervision rules at §3 + sub-points
  "2 CSR 70-25.010": {
    kind: "pdf",
    page: 3,
    sectionTitle: "2 CSR 70-25.010 — Definitions",
  },
  "2 CSR 70-25.010(3)(C)(3)": {
    kind: "pdf",
    page: 3,
    sectionTitle: "§.010(3)(C)(3) — Work-order minimum content",
  },
  "2 CSR 70-25.010(3)(C)(7)": {
    kind: "pdf",
    page: 3,
    sectionTitle: "§.010(3)(C)(7) — Supervisor reachable by phone",
  },
  "2 CSR 70-25.010(3)(C)(8)": {
    kind: "pdf",
    page: 3,
    sectionTitle: "§.010(3)(C)(8) — Supervisor on site when label requires",
  },

  // §.120 Records (the bulk of the compliance matrix lives here)
  "2 CSR 70-25.120": {
    kind: "pdf",
    page: 15,
    sectionTitle:
      "2 CSR 70-25.120 — Contents of Records (Certified Commercial / Noncommercial / Public Operator)",
  },
  "2 CSR 70-25.120(1)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(1) — Three-business-day completion rule",
  },
  "2 CSR 70-25.120(A)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(A) — Applicator name + license #",
  },
  "2 CSR 70-25.120(B)": {
    kind: "pdf",
    page: 15,
    sectionTitle:
      "§.120(4)(B) — Noncertified / technician / trainee names + license #s",
  },
  "2 CSR 70-25.120(C)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(C) — Application date, start time, end time",
  },
  "2 CSR 70-25.120(D)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(D) — Requester name and address",
  },
  "2 CSR 70-25.120(E)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(E) — Application site address or description",
  },
  "2 CSR 70-25.120(F)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(F) — Size of area treated",
  },
  "2 CSR 70-25.120(G)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(G) — Site / crop / commodity / stored product",
  },
  "2 CSR 70-25.120(H)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(H) — Target pest(s)",
  },
  "2 CSR 70-25.120(I)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(I) — Complete product trade name",
  },
  "2 CSR 70-25.120(J)": {
    kind: "pdf",
    page: 15,
    sectionTitle:
      "§.120(4)(J) — EPA registration # + Special Local Need (SLN) #",
  },
  "2 CSR 70-25.120(K)": {
    kind: "pdf",
    page: 15,
    sectionTitle: "§.120(4)(K) — Mixture rate, total amount, application rate",
  },
  "2 CSR 70-25.120(L)": {
    kind: "pdf",
    page: 15,
    sectionTitle:
      "§.120(4)(L) — Pre-mixed / ready-to-use amount and actual rate",
  },
  "2 CSR 70-25.120(M)": {
    kind: "pdf",
    page: 15,
    sectionTitle:
      "§.120(4)(M) — Outdoor air temperature, wind speed, wind direction",
  },
  "2 CSR 70-25.120(N)": {
    kind: "pdf",
    page: 15,
    sectionTitle:
      "§.120(4)(N) — Producer's lesser-than-label request (written, signed, dated)",
  },

  // §.100 + §.140 — license categories
  "2 CSR 70-25.100": {
    kind: "pdf",
    page: 8,
    sectionTitle:
      "2 CSR 70-25.100 — Categories for Commercial / Noncommercial / Public Operator",
  },
  "2 CSR 70-25.140": {
    kind: "pdf",
    page: 16,
    sectionTitle: "2 CSR 70-25.140 — Categories for Private Applicators",
  },

  // External Missouri statutes (RSMo) — referenced by the regulation but not
  // included in the compiled PDF. Render the chip as non-clickable; the user
  // can look these up in the Missouri Revised Statutes if they need to.
  "RSMo 281.035": {
    kind: "external",
    sectionTitle:
      "RSMo 281.035 — Pesticide recordkeeping and three-year retention duty (Missouri Revised Statutes)",
  },
  "RSMo 281.037(9)": {
    kind: "external",
    sectionTitle:
      "RSMo 281.037(9) — Restricted-use pesticide requires a certified applicator",
  },

  // Internal FieldLog tags (not statutory; used for chain-of-custody +
  // operational checks that exist outside the matrix).
  FIFRA_LABELING: {
    kind: "internal",
    sectionTitle:
      "FIFRA labeling — federal label-consistency obligations (cross-cutting, not a single CSR section)",
  },
  FIELDLOG_CHAIN_OF_CUSTODY: {
    kind: "internal",
    sectionTitle:
      "FieldLog chain-of-custody — submitter identity, submission timestamp, append-only event log",
  },
  FIELDLOG_OPERATIONAL: {
    kind: "internal",
    sectionTitle:
      "FieldLog operational — evidence-quality fields (weather capture provenance, GPS coordinates)",
  },
};

// Path the dialog uses for the iframe `src`. Build absolute so it works
// regardless of the route the dialog opens from.
export const REGULATION_PDF_PATH = "/missouri-2-csr-70-25.pdf";

export function lookupCitation(
  citationShort: string
): CitationDestination | undefined {
  return CITATION_REGISTRY[citationShort];
}

// All citation strings the registry knows about. Exposed so a build-time
// invariant test can assert every `citationShort` emitted by the compliance
// engine appears here (matches the sourceTags.test.ts pattern).
export function registeredCitations(): string[] {
  return Object.keys(CITATION_REGISTRY);
}

// Builds the iframe `src` for a clickable PDF citation. Returns null for
// non-pdf destinations (callers should render the chip non-clickable).
export function buildPdfHref(
  citation: CitationDestination
): string | null {
  if (citation.kind !== "pdf") return null;
  return `${REGULATION_PDF_PATH}#page=${citation.page}`;
}
