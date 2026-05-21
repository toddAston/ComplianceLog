import { describe, expect, it } from "vitest";
import { rules } from "../application/compliance/index";
import {
  buildPdfHref,
  lookupCitation,
  registeredCitations,
  REGULATION_PDF_PATH,
} from "./regulationCitations";

describe("regulationCitations registry", () => {
  // Build-time invariant: every citationShort the engine emits has a
  // registry entry. Mirrors the sourceTags.test.ts pattern that guards
  // against rules shipping with empty citation tags. Catches the case
  // where a new rule lands with a tag the citation dialog doesn't know
  // how to open.
  it("every compliance rule's citationShort is registered", () => {
    const emitted = new Set(rules.map((r) => r.citationShort));
    const registered = new Set(registeredCitations());
    const missing: string[] = [];
    for (const tag of emitted) {
      if (!registered.has(tag)) missing.push(tag);
    }
    expect(
      missing,
      `Missing citation registry entries: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("buildPdfHref returns a #page=N anchor for PDF-backed citations", () => {
    const records = lookupCitation("2 CSR 70-25.120(D)");
    expect(records).toBeDefined();
    expect(records?.kind).toBe("pdf");
    const href = buildPdfHref(records!);
    expect(href).toBe(`${REGULATION_PDF_PATH}#page=15`);
  });

  it("buildPdfHref returns null for external statute citations (RSMo)", () => {
    const rsmo = lookupCitation("RSMo 281.035");
    expect(rsmo?.kind).toBe("external");
    expect(buildPdfHref(rsmo!)).toBeNull();
  });

  it("buildPdfHref returns null for internal FieldLog source tags", () => {
    for (const tag of [
      "FIFRA_LABELING",
      "FIELDLOG_CHAIN_OF_CUSTODY",
      "FIELDLOG_OPERATIONAL",
    ]) {
      const dest = lookupCitation(tag);
      expect(dest?.kind).toBe("internal");
      expect(buildPdfHref(dest!)).toBeNull();
    }
  });

  it("lookupCitation returns undefined for unknown citations", () => {
    expect(lookupCitation("totally-not-a-citation")).toBeUndefined();
  });

  it("every PDF-backed destination resolves to a positive page number", () => {
    for (const tag of registeredCitations()) {
      const dest = lookupCitation(tag);
      if (dest?.kind !== "pdf") continue;
      expect(dest.page, `Citation ${tag} page`).toBeGreaterThan(0);
    }
  });

  it("every destination has a non-empty section title", () => {
    for (const tag of registeredCitations()) {
      const dest = lookupCitation(tag);
      expect(dest?.sectionTitle.length ?? 0).toBeGreaterThan(0);
    }
  });
});
