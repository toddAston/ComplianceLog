# Task: Regulatory Citation Research for Compliance Rules

You are working in a parallel Claude Code window to flesh out the **verbatim citation text and rationale** for each P1 / P2 compliance rule in the FieldLog matrix. The main session is busy implementing Phase 1 + Phase 2 rule code; you are doing pure read/research and producing a markdown reference doc — no code changes.

## Output

Produce a single new file at:

`docs/build/compliance-citations.md`

It should be a structured reference doc that the rule modules can pull citation text and rationale from. For **each** of the rule matrix items listed below, include:

- **Matrix #** and short title
- **Source tag** (already in the matrix — e.g. `2_CSR_70_25_120_4_M`, `FIFRA_LABELING`, `RSMO_281_035`)
- **Citation (verbatim)** — direct, quoted regulatory text from the source PDFs / EPA materials
- **Citation short form** — the citation in compact form (e.g. `2 CSR 70-25.120(4)(M)`, `FIFRA 12(a)(2)(G)`)
- **Rationale** — 1-3 sentence plain-language explanation of *why this rule exists and what it requires*. This is what shows up in the FieldLog audit output to explain a `NEEDS_REVIEW` / `LABEL_VERIFICATION_REQUIRED` flag to a contractor or auditor.
- **Edge cases / nuance** — anything in the source that affects how the rule should be evaluated (e.g. exceptions, "if applicable" qualifiers, scope limitations)

## Sources to Read

All in this repo, no internet needed:

1. **`research/regulatory/APPRIL_User_Guide_Public.pdf`** — EPA's public-facing APPRIL guide; covers RUP product registration data.
2. **`research/regulatory/APPRIL_REST_API_User_Guide.pdf`** — APPRIL REST API guide.
3. **`research/regulatory/rups-rpt.pdf`** — Restricted Use Pesticides report.
4. **`docs/build/compliance checks.md`** — **The matrix.** This is the spec — read it first. It already lists short source tags for every item; your job is to flesh those tags out into verbatim citation text + rationale.
5. **`FieldLog Development Blueprint.md`** (repo root) — has regulatory background analysis. Pull from here for rationale framing.
6. **`docs/architecture/reproducible-design/fieldlog_reproducible_design_v0_1.md`** — design snapshot.

If a Missouri statute or regulation is referenced (`2 CSR 70-25.120`, `RSMo 281.035`, `2 CSR 70-25.010`) and the verbatim text is not in the PDFs, note that explicitly in the citation field — write `[Verbatim text not in local sources — citation form only]` rather than inventing language. **Do not fabricate regulatory text.**

## Rules to Cover (in priority order)

### P1 — Conditional Applicability (matrix #1-4, #10-15, #26, #33-34, #41-43, #45)
### P1 — Label Verification (matrix #35-36, #56-64)
### P2 — Tank Mix Refinement (matrix #65-67)
### P2 — Noncertified Supervision (matrix #68-71)
### P2 — GPS / Weather Evidence Quality (matrix #49-51, #72)

Cover P1 first thoroughly. If you run out of time/context, P2 can be partial — but mark which items are stubs.

## Format Suggestion

```markdown
## #35 — Product label attached or linked
**Source tags:** `FIFRA_LABELING`, `FIELDLOG_OPERATIONAL`
**Citation short:** FIFRA 12(a)(2)(G)
**Citation (verbatim):** "It shall be unlawful for any person ... to use any registered pesticide in a manner inconsistent with its labeling." — FIFRA §12(a)(2)(G), 7 U.S.C. §136j(a)(2)(G)
**Rationale:** A pesticide label is the legally binding instruction set. Without a label reference attached to the application record, FieldLog cannot show that the applicator had access to label directions at the time of use, and no downstream label-consistency check can be performed. FieldLog therefore flags every record without a label reference for human review rather than auto-passing it.
**Edge cases:** A record with a verified product catalog entry that includes a known label URL/version satisfies this; a free-text product name does not.
```

## Constraints

- **Pure research — do not modify code.** Do not touch any `.ts`, `.tsx`, schema, or service files. Your only output is `docs/build/compliance-citations.md`.
- Do not commit. Leave the file uncommitted so the main session can review and integrate.
- Do not fabricate regulatory text — if a verbatim quote isn't in the local PDFs, say so.
- Quote PDFs faithfully; use page numbers when you have them.
- The main session is doing code work in parallel — your output will be consumed afterward.

When you're done, output a one-paragraph summary of what's in the new doc and which matrix items you covered vs. stubbed, then stop.
