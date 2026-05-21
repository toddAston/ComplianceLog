# FieldLog Compliance Citations Reference

Verbatim citation text, short-form cites, rationale, and edge-case notes for the
P1 / P2 compliance rules in the FieldLog matrix
(`docs/build/compliance checks.md`). Keyed by matrix # and cross-walked to the
`ruleId` strings already in `src/application/compliance/rules/*.ts` so the
contents of `citation` fields in the rule modules can be lifted directly from
here.

## Sources consulted

| Source | Location | Verbatim available here? |
|---|---|---|
| Missouri Revised Statutes, Chapter 281 (RSMo 281.035, .037, .045, .050) | Referenced by paraphrase in `FieldLog Development Blueprint.md` §1 / §2 | No verbatim text in local files |
| 2 CSR 70-25.120 (Missouri applicator recordkeeping) | Referenced by paraphrase in `FieldLog Development Blueprint.md` §1 / §2 (R1–R7) | No verbatim text in local files |
| 2 CSR 70-25.010 (Missouri certification / supervision rule) | Referenced by tag in matrix; not paraphrased in Blueprint | No verbatim text in local files |
| FIFRA §12(a)(2)(G) — 7 U.S.C. §136j(a)(2)(G) | Referenced by paraphrase in `FieldLog Development Blueprint.md` §1 | No verbatim text in local files |
| `research/regulatory/APPRIL_User_Guide_Public.pdf` | Repo | Not readable in this environment (no PDF text-extraction tool); not a source of regulatory text in any case — it's an EPA tooling guide for RUP product registration data |
| `research/regulatory/APPRIL_REST_API_User_Guide.pdf` | Repo | Same — API guide, not regulatory text |
| `research/regulatory/rups-rpt.pdf` | Repo | Same — RUP report tooling, not regulatory text |

**Important convention used throughout this doc:** where the verbatim regulatory
text is not in the local PDFs (which is the case for every Missouri statute and
regulation, since the repo doesn't carry the RSMo/CSR text), the **Citation
(verbatim)** field reads
`[Verbatim text not in local sources — citation form only]` per the brief, and
the rule meaning is conveyed in plain language in the **Rationale** and **Edge
cases / nuance** fields. This is deliberate: the rule code already carries
paraphrased citations and the docs win over invented text.

Where a Blueprint passage closely paraphrases the source (e.g. the field list at
`2 CSR 70-25.120(4)`), that paraphrase is reproduced in the Rationale and marked
as a paraphrase, not as a verbatim quote.

---

# P1 — Conditional Applicability

## #1 — Applicator category classified
**Rule ID (code):** `APPLICATOR_CATEGORY_UNKNOWN`
**Source tags:** `2_CSR_70_25_120`, `RSMO_281_035`
**Citation short:** `2 CSR 70-25.120` / `RSMo 281.035`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Missouri's recordkeeping duty is keyed off applicator category:
RSMo 281.035 places the duty on certified commercial applicators (and their
employers) for *all* pesticide uses, while 2 CSR 70-25.120 extends a narrower
duty (RUPs only) to certified noncommercial applicators and public operators.
The downstream applicability of nearly every other rule (#2, #3, #10–#15, #68)
depends on knowing which category the record is in, so FieldLog flags
`unknown` / unset category for human review rather than silently passing it.
**Edge cases / nuance:**
- Private applicators and trainees/technicians are also distinct categories
  under Missouri's licensing scheme; "noncertified" is itself ambiguous (could
  be an unlicensed helper, a technician trainee, or an RUP-trained noncertified
  applicator), so the rule treats every category that the form lets the user
  pick as a *classification answer*, not a presence/absence answer.
- 7 CFR Part 110 was rescinded July 2025, so federal private-applicator
  recordkeeping is no longer a parallel duty in 2026; this rule cites Missouri
  law only.

## #2 — Commercial applicator record duty
**Rule ID (code):** `COMMERCIAL_RECORD_DUTY`
**Source tags:** `RSMO_281_035`, `2_CSR_70_25_120`
**Citation short:** `RSMo 281.035(7)` / `2 CSR 70-25.120(1)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** RSMo 281.035 places the recordkeeping duty for pesticide
applications on the certified commercial applicator *or* their employer; the
record must be maintained, complete within three business days, and kept three
years. FieldLog therefore needs to identify *who* the responsible
recordkeeper is — applicator alone, or the employer organization — for a
commercial record. Without that identification the chain-of-custody story
breaks and an inspector cannot tell whose duty was discharged.
**Edge cases / nuance:**
- The duty is *or*-ed: applicator **or** employer. FieldLog's current rule
  requires both an applicator name and a company because the operational design
  is that submissions come from a contractor working for an organization, but
  the underlying statute is satisfied by either one identifying themselves.
- The duty in RSMo 281.035 covers all pesticide uses for certified commercial
  applicators, not just RUPs — that distinguishes it from #3.

## #3 — Noncommercial / public operator RUP duty
**Rule ID (code):** `NONCOMMERCIAL_PUBLIC_RUP_DUTY`
**Source tags:** `2_CSR_70_25_120`
**Citation short:** `RSMo 281.037(9)` (noncommercial) / `RSMo 281.045(8)` (public operator) / `2 CSR 70-25.120(2)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Noncommercial and public-operator categories have a *narrower*
recordkeeping duty than commercial: they must keep records only for
restricted-use pesticide applications. The same three-business-day completion
and three-year retention obligations apply. FieldLog flags this rule when the
record is noncommercial/public *and* the product is RUP, because that is the
exact combination where the duty bites.
**Edge cases / nuance:**
- The duty is conditional on RUP status. If the product is general-use, the
  rule is not triggered for a noncommercial / public-operator record at all.
- If the RUP status of the product is `unknown` (see #4), this rule should
  defer to the label-verification flow rather than firing immediately, because
  applicability cannot be determined.

## #4 — Pesticide RUP / general-use status known
**Rule ID (code):** `PESTICIDE_TYPE_UNKNOWN`
**Source tags:** `2_CSR_70_25_120`, `FIFRA_LABELING`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G)) / `2 CSR 70-25.120`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Whether a product is restricted-use (RUP), general-use, or
minimum-risk drives both recordkeeping duty (see #3) and certification
requirements (only certified applicators or noncertified RUP applicators under
supervision may apply RUPs). The information lives on the product label and in
EPA's registration data; without it FieldLog can't decide which downstream
duties apply, so it emits `LABEL_VERIFICATION_REQUIRED` and routes the
question to human review rather than guessing.
**Edge cases / nuance:**
- RUP designation is product-specific and may change as EPA updates a
  registration; the *label* is the legally binding instruction set per FIFRA.
- Minimum-risk pesticides (40 CFR §152.25(f)) are exempt from much of FIFRA,
  but that's an *escape* from recordkeeping, not a free pass — FieldLog should
  still flag the unknown state.

## #10 — Noncertified applicator name recorded
**Rule ID (code):** `MISSING_NONCERTIFIED_APPLICATOR_NAME`
**Source tags:** `2_CSR_70_25_120_4_B`
**Citation short:** `2 CSR 70-25.120(4)(B)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** 2 CSR 70-25.120(4)(B) requires that when a *noncertified*
applicator (or technician, or trainee) participates in the application, their
name be recorded. The certified applicator's name (rule field A) is not a
substitute — the regulation wants both, because the noncertified person is
operating under supervision and the chain of accountability needs to be
explicit.
**Edge cases / nuance:**
- Only applies when a noncertified applicator participated (see #1 — category
  classification gates this rule).
- "Noncertified" in this matrix item is the broad bucket that does *not*
  include the more specific noncertified-RUP-applicator (#11/#12) or
  technician/trainee (#13–#15) sub-roles.

## #11 — Noncertified RUP applicator name recorded
**Rule ID (code):** `MISSING_NONCERTIFIED_RUP_APPLICATOR_NAME`
**Source tags:** `2_CSR_70_25_120_4_B`
**Citation short:** `2 CSR 70-25.120(4)(B)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Same regulatory hook as #10, but for the specific case of a
noncertified RUP applicator (a worker who has completed the federal/state RUP
training requirement but is not themselves a certified applicator). Missouri's
record must capture this person's name so an inspector can verify that the
RUP-trained-noncertified status was the legal basis for them participating.
**Edge cases / nuance:**
- Distinct from #10 because the noncertified-RUP role carries different
  licensing/training prerequisites; the *recordkeeping* requirement is
  parallel but the legal authorization story is different.

## #12 — Noncertified RUP applicator license recorded
**Rule ID (code):** `MISSING_NONCERTIFIED_RUP_APPLICATOR_LICENSE`
**Source tags:** `2_CSR_70_25_120_4_B`
**Citation short:** `2 CSR 70-25.120(4)(B)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Per 2 CSR 70-25.120(4)(B), the noncertified RUP applicator's
*license number* (the training/credential identifier) must accompany their
name. Name without license is insufficient — without the license number an
inspector cannot verify that the person was authorized to handle the RUP under
supervision.
**Edge cases / nuance:**
- A *certified* applicator's license number is required separately under field
  (A) — that's matrix #9, not this rule.

## #13 — Pesticide technician trainee name recorded
**Rule ID (code):** `MISSING_TRAINEE_NAME`
**Source tags:** `2_CSR_70_25_120_4_B`
**Citation short:** `2 CSR 70-25.120(4)(B)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Trainees are listed alongside technicians and noncertified
applicators under field (B) of 2 CSR 70-25.120(4). Where a trainee participated
in the application, the record must capture their name — so a later inspector
can see who was being trained and confirm they were not operating
independently.
**Edge cases / nuance:**
- Trainee status is a Missouri-specific classification; if the record category
  is "trainee" this rule fires.
- License number is *not* required for a pure trainee (vs. #15 for
  technicians), reflecting that trainees may not yet hold one.

## #14 — Pesticide technician name recorded
**Rule ID (code):** `MISSING_TECHNICIAN_NAME`
**Source tags:** `2_CSR_70_25_120_4_B`
**Citation short:** `2 CSR 70-25.120(4)(B)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** A pesticide technician is a licensed-but-not-certified
applicator under Missouri's scheme; their name is required by 2 CSR
70-25.120(4)(B) when they participated in the application, on the same
chain-of-accountability rationale as #10–#13.
**Edge cases / nuance:**
- Paired with #15 (license number) — both must be present for a complete
  technician record.

## #15 — Pesticide technician license recorded
**Rule ID (code):** `MISSING_TECHNICIAN_LICENSE`
**Source tags:** `2_CSR_70_25_120_4_B`
**Citation short:** `2 CSR 70-25.120(4)(B)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** A technician's license number must be on the record per 2 CSR
70-25.120(4)(B). Unlike a pure trainee (#13), the technician role carries a
state-issued license, so the regulation requires both pieces of identification.
**Edge cases / nuance:**
- If the record category is "trainee" rather than "technician," this rule does
  not fire — see #13 for the trainee equivalent (name only).

## #26 — Indoor spot/crack-crevice exemption classified
**Rule ID (code):** `INDOOR_EXEMPTION_NOT_CLASSIFIED`
**Source tags:** `2_CSR_70_25_120_4_F`
**Citation short:** `2 CSR 70-25.120(4)(F)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Field (F) of 2 CSR 70-25.120(4) — *area treated* — carries an
exemption for indoor spot and crack-and-crevice applications, where measuring
a "treated area" is operationally meaningless. The classification answer
drives whether matrix #24 / #25 (area + units) is required. FieldLog
explicitly asks the operator to classify the application so the applicability
of the area-size requirement is deterministic.
**Edge cases / nuance:**
- The rule only fires for indoor / structural / warehouse-type site types —
  for outdoor agricultural applications the question is irrelevant and the
  area-size requirement always applies.
- "Spot" and "crack-and-crevice" are terms of art from the structural pest
  control industry; an applicator unsure of the classification should answer
  "no" and capture the area rather than rely on the exemption.

## #33 — Special Local Need (SLN) registration number confirmed
**Rule ID (code):** `SLN_NUMBER_NOT_CONFIRMED`
**Source tags:** `2_CSR_70_25_120_4_J`
**Citation short:** `2 CSR 70-25.120(4)(J)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Field (J) of 2 CSR 70-25.120(4) requires recording the EPA
registration number *and*, if applicable, the Special Local Need (SLN, sometimes
"24(c)" after FIFRA §24(c)) registration number. SLN registrations are
state-specific labels that expand or modify the federal label for a
state-specific pest problem; when one is the legal basis for the use, the SLN
number is part of the record, not optional metadata. FieldLog asks the operator
to confirm SLN applicability rather than silently treating absence as "no SLN."
**Edge cases / nuance:**
- Most applications will not involve an SLN. The rule's job is to surface the
  question, not to assume one applies.
- An SLN can supersede label site/rate/use directions only as written into the
  SLN — when an SLN is in play, label-review checks (#56–#64) should consider
  both the federal label and the SLN.

## #34 — EPA registration correlation evidence non-blank
**Rule ID (code):** `EPA_CORRELATION_EVIDENCE_PARTIAL`
**Source tags:** `2_CSR_70_25_120_4_J`
**Citation short:** `2 CSR 70-25.120(4)(J)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Field (J) wants the EPA registration number itself, but the
matrix acknowledges that operators sometimes document the registration by
*correlation evidence* (e.g. a referenced invoice or a label photo) rather
than typing the EPA reg # directly. The rule says: if you go the correlation
route, the evidence identifier must be a real, non-blank reference. Empty
whitespace defeats the purpose of the exception.
**Edge cases / nuance:**
- Only fires when the EPA registration number field is blank *and* the
  operator has populated the correlation evidence field — i.e. the operator is
  explicitly relying on the exception path.
- An operator who supplies the EPA number directly does not need correlation
  evidence and this rule won't fire.

## #41 — Premixed / ready-to-use product flag
*(Implementation-level note: matrix #41 is the "is the product pre-mixed?"
classification question. The rule code combines this with #42 and #43 — when
the operator has flagged `isPremixed: true`, the conditional rules below
require the premixed amount used and actual rate. The bare flag itself does
not get its own NEEDS_REVIEW rule in the current implementation; it's the
gate for #42 / #43.)*

## #42 — Premixed amount used recorded
**Rule ID (code):** `MISSING_PREMIXED_AMOUNT`
**Source tags:** `2_CSR_70_25_120_4_L`
**Citation short:** `2 CSR 70-25.120(4)(L)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Field (L) of 2 CSR 70-25.120(4) requires, for pre-mixed /
ready-to-use products, a reasonable estimate of the *amount used*. Pre-mixed
products don't have a separately recorded mixture rate (#37–#38), so (L) is
the parallel data point for them. Without an amount estimate, an inspector
cannot reconstruct what was applied.
**Edge cases / nuance:**
- Only applies when `isPremixed === true`. A non-pre-mixed product satisfies
  the equivalent data point through #37–#40 (mixture rate + total amount +
  application rate + units).
- "Reasonable estimate" is the regulation's own language — exact metering is
  not required, but a *number* is.

## #43 — Premixed actual application rate recorded
**Rule ID (code):** `MISSING_PREMIXED_ACTUAL_RATE`
**Source tags:** `2_CSR_70_25_120_4_L`
**Citation short:** `2 CSR 70-25.120(4)(L)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Field (L) requires the *actual rate of application* for
pre-mixed products in addition to the amount used (#42). Together they
substitute for the mixture-rate/total-amount/rate triple required of
non-premixed products. The actual rate is what an inspector can compare
against the label's allowed range.
**Edge cases / nuance:**
- Only applies when `isPremixed === true`.
- The actual rate may differ from the label-suggested rate if a lesser
  concentration was requested in writing (see matrix #52–#55 / field (N)).

## #45 — Structural / termite-within-10-ft exception classified
**Rule ID (code):** `STRUCTURAL_TERMITE_EXCEPTION_NOT_CLASSIFIED`
**Source tags:** `2_CSR_70_25_120_4_M`
**Citation short:** `2 CSR 70-25.120(4)(M)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Field (M) of 2 CSR 70-25.120(4) — *air temperature, measured
wind speed, wind direction for outdoor applications* — exempts general
structural pest control and termite pest control performed within 10 feet of
a building. The classification answer drives whether matrix #46–#48 (weather
trio) is required. FieldLog asks the operator to classify so the applicability
of the outdoor-weather requirement is deterministic.
**Edge cases / nuance:**
- The 10-foot perimeter is regulation-specified; an outdoor termite
  application more than 10 feet from a structure does *not* fit this exception
  and the weather record is required.
- Rule only fires for site types matching structural/termite — outdoor
  agricultural records skip it.

---

# P1 — Label Verification

## #35 — Product label attached or linked
**Rule ID (code):** `LABEL_NOT_ATTACHED`
**Source tags:** `FIFRA_LABELING`, `FIELDLOG_OPERATIONAL`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G))
**Citation (verbatim):** [Verbatim text not in local sources — citation form only — the FIFRA prohibition is paraphrased in `FieldLog Development Blueprint.md` §1: "Use only as labeled; label is enforceable; violation = prohibited use"]
**Rationale:** FIFRA §12(a)(2)(G) makes it unlawful to use a registered
pesticide in a manner inconsistent with its labeling. Without a label reference
attached to the FieldLog record, no downstream label-consistency check is
possible and the auditor cannot show that the applicator had access to label
directions at the time of use. FieldLog therefore flags every record without a
label reference for human review (`LABEL_VERIFICATION_REQUIRED`) rather than
auto-passing it; the rule emits `unknown`, not `fail`, because the absence is
operational, not a Missouri-record-required-field violation.
**Edge cases / nuance:**
- A verified product-catalog entry that carries a label URL/file satisfies
  this; a free-text product name does not.
- FieldLog does not adjudicate label consistency itself — that's the line in
  the matrix preamble: "label-related checks should be flagged as 'review
  required,' not treated as automatically resolved by record completeness."

## #36 — Label version / retrieval date recorded
**Rule ID (code):** `LABEL_VERSION_OR_DATE_MISSING`
**Source tags:** `FIFRA_LABELING`, `FIELDLOG_OPERATIONAL`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G))
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Pesticide labels are updated by EPA as registrations evolve;
the *version* of the label that was reviewed at the time of application is
itself evidence. Without a version or retrieval date, a label reference can
drift away from the label that was actually in effect on the application date.
FieldLog flags absence for review — operationally, the safest field is the
date the label was retrieved from EPA PPLS or the version date printed on the
label.
**Edge cases / nuance:**
- Only fires when a label reference is present (#35). It's a quality flag on
  *that* reference, not a duplicate of #35.
- A retrieval timestamp is acceptable when a version/print date isn't
  available — both are evidence-of-currency.

## #56 — Product registered / label source available
**Rule ID (code):** *(covered by `LABEL_NOT_ATTACHED` (#35) in current code; no standalone rule yet)*
**Source tags:** `FIFRA_LABELING`
**Citation short:** `FIFRA §3` (7 U.S.C. §136a) — registration of pesticides; `FIFRA §12(a)(2)(G)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** A registered pesticide has an EPA registration number and a
master label held in EPA's PPLS system. Whether FieldLog has access to that
label source — either via the product-catalog entry's EPA reg #, a stored
label file, or a known PPLS link — determines whether any label-consistency
review can take place at all. If no source is available, the record carries a
`SOURCE_UNAVAILABLE` annotation; if a source exists but isn't attached, #35
fires.
**Edge cases / nuance:**
- Minimum-risk pesticides (40 CFR §152.25(f)) are not federally registered;
  they will not have an EPA reg # or a PPLS label.
- Cancelled or suspended products may still appear in catalogs — a registered
  product that the operator possesses may no longer be lawfully usable; this
  rule says nothing about that, only that the *source* exists.

## #57 — Label consistency review flag
**Rule ID (code):** `LABEL_CONSISTENCY_NOT_REVIEWED`
**Source tags:** `FIFRA_LABELING`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G))
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** The umbrella label-review acknowledgment: someone has reviewed
that the use is consistent with the product label, or has not. FieldLog
*never* auto-passes this — the rule status stays `unknown` until the operator
explicitly acknowledges the review. The matrix is explicit ("do not auto-pass
unless future label engine supports it") because asserting label consistency
without a human in the loop crosses the "compliance tracking, not compliance
adjudication" line that defines the product.
**Edge cases / nuance:**
- All seven of the more-specific label-review acknowledgments (#58–#64) live
  under this umbrella; checking #57 without the underlying review is a
  fabrication risk.
- Future direction (the matrix calls out "future label engine") is to
  cross-check label-encoded crop/site/rate/etc. against the record
  programmatically — but the umbrella acknowledgment still belongs to a human.

## #58 — Crop / site reviewed against label
**Rule ID (code):** `LABEL_CROP_SITE_NOT_REVIEWED`
**Source tags:** `FIFRA_LABELING`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G))
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Labels enumerate the crops and sites a product may lawfully be
applied to. Applying a pesticide to an unlisted crop is the canonical "use
inconsistent with labeling" violation. FieldLog asks the operator to flag the
crop/site review as completed; the rule applies only when a crop or site is
populated on the record.
**Edge cases / nuance:**
- "Crop group" labels (e.g. "stone fruit" covering multiple species) are
  permissible — review must follow the label's own scope language.
- Sites listed on an SLN (#33) are also lawful within that state, even if not
  on the federal label.

## #59 — Target pest reviewed against label
**Rule ID (code):** `LABEL_TARGET_PEST_NOT_REVIEWED`
**Source tags:** `FIFRA_LABELING`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G))
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Labels list pests against which the product is registered.
Applying for a pest that is neither listed nor *not prohibited* by the label
risks a labeling violation. FieldLog asks for an explicit review
acknowledgment when the record carries a target pest.
**Edge cases / nuance:**
- Some labels permit broad pest categories ("aphids") rather than species;
  others list specific species. Review must match the label's specificity.
- A pest "not prohibited" is the legal floor — pesticide labels often grant
  broader latitude than the explicit list when the label says "for control of
  ... and other insects."

## #60 — Application rate reviewed against label
**Rule ID (code):** `LABEL_RATE_NOT_REVIEWED`
**Source tags:** `FIFRA_LABELING`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G))
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Label rate ranges and per-acre / per-season maxima are
enforceable. Exceeding the label rate is a clear label-inconsistency
violation; applying *less* than the label rate is permissible only with the
written-request process under #52–#55. FieldLog flags the review for explicit
acknowledgment whenever a rate is recorded.
**Edge cases / nuance:**
- Tank-mix synergies do not automatically permit lower per-product rates
  unless the label allows the mix.
- Spot vs. broadcast application rates often differ on the same label.

## #61 — Timing / method reviewed against label
**Rule ID (code):** `LABEL_TIMING_METHOD_NOT_REVIEWED`
**Source tags:** `FIFRA_LABELING`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G))
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Labels specify application timing (e.g. growth stage,
pre-emergence vs. post-emergence) and method (e.g. broadcast, banded, aerial,
soil drench). Mis-timed or wrong-method applications are label
inconsistencies. FieldLog asks for explicit review.
**Edge cases / nuance:**
- Some methods (e.g. aerial) carry additional federal/state requirements
  beyond the label.
- Timing review interacts with #63 (REI/PHI) — they're separate
  acknowledgments because they fail in different ways.

## #62 — Label-required PPE reviewed
**Rule ID (code):** `LABEL_PPE_NOT_REVIEWED`
**Source tags:** `FIFRA_LABELING`, optional `2_CSR_70_25_010_DIRECT_SUPERVISION`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G)); 40 CFR Part 170 (WPS) for agricultural uses
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Labels list required personal protective equipment (gloves,
respirators, coveralls, eyewear, etc.). The EPA Worker Protection Standard
(40 CFR Part 170) also imposes PPE requirements for agricultural uses
independent of the label. FieldLog flags PPE review for acknowledgment so the
audit packet shows the PPE step was not skipped.
**Edge cases / nuance:**
- WPS PPE may be stricter than the label in narrow cases; review should
  consult both.
- Closed-system handling exceptions on the label can modify PPE; the review
  must match the actual handling method used.

## #63 — REI / PHI reviewed against label
**Rule ID (code):** `LABEL_REI_PHI_NOT_REVIEWED`
**Source tags:** `FIFRA_LABELING`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G)); 40 CFR Part 170 (REI under WPS)
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** The Restricted-Entry Interval (REI) is the post-application
period during which workers may not enter the treated area without PPE; the
Pre-Harvest Interval (PHI) is the minimum interval between application and
harvest. Both are label-set and enforceable. FieldLog flags the review for
acknowledgment when the record concerns an agricultural crop/site.
**Edge cases / nuance:**
- REI applies primarily to agricultural uses regulated by WPS; non-ag
  applications may not carry one.
- PHI is crop-specific on the label and may not exist for non-food sites.

## #64 — Drift / buffer / weather restrictions reviewed
**Rule ID (code):** `LABEL_DRIFT_BUFFER_NOT_REVIEWED`
**Source tags:** `FIFRA_LABELING`
**Citation short:** `FIFRA §12(a)(2)(G)` (7 U.S.C. §136j(a)(2)(G))
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Many labels carry explicit wind-speed maxima, buffer-zone
requirements (distance to sensitive areas, water, residences), and weather
prohibitions (no application before rain, temperature limits, inversion
restrictions). These are the most common label-driven drift/off-target
violations. FieldLog flags the review whenever the application is outdoor.
**Edge cases / nuance:**
- Dicamba and 2,4-D labels are the canonical examples — they carry detailed,
  product-specific drift mitigation requirements.
- Buffer requirements may also exist under state pollinator-protection rules
  separate from the federal label.

---

# P2 — Tank Mix Refinement

## #65 — Tank mix products listed individually
**Rule ID (code):** `TANK_MIX_PRODUCT_LIST_INCOMPLETE`
**Source tags:** `2_CSR_70_25_120_4_I_J_K`, `FIELDLOG_OPERATIONAL`
**Citation short:** `2 CSR 70-25.120(4)(I)(J)(K)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** A tank-mix application combines multiple products in one
spray; Missouri's record fields (I) trade name(s), (J) EPA registration #(s),
and (K) mixture rate / total amount each contemplate listing per-product
data. Treating a tank mix as one undifferentiated blob would lose
product-specific traceability. FieldLog requires every product in the mix to
be listed with at least a trade name.
**Edge cases / nuance:**
- Only fires when at least one tank-mix product entry exists. A single-product
  application uses the main product fields, not the tank-mix list.
- Adjuvants and surfactants are technically tank-mix additions; current code
  doesn't distinguish them, but a label review (#57–#64) should.

## #66 — Tank mix EPA registration numbers
**Rule ID (code):** `TANK_MIX_MISSING_EPA`
**Source tags:** `2_CSR_70_25_120_4_J`
**Citation short:** `2 CSR 70-25.120(4)(J)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Field (J) requires the EPA registration number for every
product in the application; in a tank mix that means every product in the
list. Without per-product EPA numbers, an inspector cannot map the mix back
to its label sources.
**Edge cases / nuance:**
- Correlation evidence (#34) can substitute for a missing direct EPA number,
  but the current tank-mix rule checks the field directly — extending it to
  honor correlation evidence is a future refinement.

## #67 — Tank mix rates / amounts
**Rule ID (code):** `TANK_MIX_MISSING_RATE_OR_AMOUNT`
**Source tags:** `2_CSR_70_25_120_4_K`
**Citation short:** `2 CSR 70-25.120(4)(K)`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Field (K) requires mixture rate and total amount; in a
tank-mix list, the natural translation is that *each* product in the mix
records either a rate or a total amount (or both). The rule treats either as
satisfying the data point — many operations record amount per product and
rate per mix as a whole.
**Edge cases / nuance:**
- A mix where every product has either a rate or an amount passes; a mix
  with even one product missing both fails. The rule accepts the operator's
  modeling choice (rate vs. amount per product).
- Pre-mixed products in a tank mix should follow field (L) per #42/#43; the
  tank-mix rule does not currently special-case pre-mixed mix-members.

---

# P2 — Noncertified Supervision Workflow

## #68 — Supervising certified applicator identified
**Rule ID (code):** `SUPERVISOR_NOT_IDENTIFIED`
**Source tags:** `RSMO_281_035`, `2_CSR_70_25_010`
**Citation short:** `RSMo 281.035` / `2 CSR 70-25.010`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Noncertified applicators (including technicians and trainees)
may only apply pesticides under the supervision of a certified applicator.
2 CSR 70-25.010 (Missouri's certification rule) sets out the supervision
expectations; RSMo 281.035 anchors the duty. FieldLog asks the operator to
record the supervising certified applicator so the chain of authority is
explicit on the record.
**Edge cases / nuance:**
- "Supervision" in Missouri ranges from direct (physical presence) to indirect
  (label/labeling-available + reachable). The rule does not distinguish — it
  captures the supervisor identity; the label-in-possession (#70) and
  work-order (#69) acknowledgments cover the indirect-supervision conditions.
- For a record where category is already "certified" (commercial / non-
  commercial / public / private), this rule does not fire.

## #69 — Work order / job ticket evidence
**Rule ID (code):** `WORK_ORDER_NOT_ACKNOWLEDGED`
**Source tags:** `2_CSR_70_25_010`
**Citation short:** `2 CSR 70-25.010`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** 2 CSR 70-25.010 describes a minimum work-order / job-ticket /
invoice with required details that a noncertified applicator must carry while
performing the application — this is the document trail that lets the
noncertified applicator demonstrate they were directed by the certified
supervisor to perform this specific work.
**Edge cases / nuance:**
- Minimum work-order content is regulation-specified (applicator,
  product/use, target, site, etc.). The acknowledgment in FieldLog is
  currently a single boolean; a future enhancement could enumerate the work
  order's required fields.
- For records where no noncertified applicator participated, this rule does
  not fire.

## #70 — Label / labeling available on site
**Rule ID (code):** `LABEL_POSSESSION_NOT_ACKNOWLEDGED`
**Source tags:** `2_CSR_70_25_010`
**Citation short:** `2 CSR 70-25.010`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** A noncertified applicator must have the product label /
labeling physically (or electronically) available at the application site
and must follow its directions. Without that, the noncertified applicator
cannot operate the product lawfully. FieldLog asks for explicit
acknowledgment.
**Edge cases / nuance:**
- "Labeling" includes supplemental and SLN labels — not just the container
  label.
- Electronic labels are acceptable if accessible at the site (a phone
  screenshot or PDF on the device counts).

## #71 — Equipment checked and usable as intended
**Rule ID (code):** `EQUIPMENT_READINESS_NOT_ACKNOWLEDGED`
**Source tags:** `2_CSR_70_25_010`
**Citation short:** `2 CSR 70-25.010`
**Citation (verbatim):** [Verbatim text not in local sources — citation form only]
**Rationale:** Pesticide application equipment that is leaking, miscalibrated,
or otherwise not usable as intended creates an off-label-application risk
even if every other field is correct. 2 CSR 70-25.010 carries an equipment
readiness expectation for noncertified-applicator workflows; FieldLog
captures the acknowledgment so the audit shows the step was not skipped.
**Edge cases / nuance:**
- Equipment "readiness" is the broad bucket — formal calibration records are
  not required by this rule, but are good evidence.
- A separate equipment-calibration check feature is a future direction;
  current code is acknowledgment only.

---

# P2 — GPS / Weather Evidence Quality

## #49 — Weather capture source recorded
**Rule ID (code):** `WEATHER_CAPTURE_SOURCE_UNKNOWN`
**Source tags:** `FIELDLOG_OPERATIONAL`
**Citation short:** *(FieldLog operational — not a regulatory requirement)*
**Citation (verbatim):** [No verbatim regulatory text — this is an evidence-quality flag, not a regulation. The underlying weather data points (#46–#48) are regulatory; the *capture provenance* is FieldLog's operational addition.]
**Rationale:** 2 CSR 70-25.120(4)(M) requires air temperature, measured wind
speed, and wind direction for outdoor applications. FieldLog separately asks
*how* those values were captured (manual entry, on-site meter, weather API,
device sensor, etc.) because the value of weather evidence depends on its
source — a manually-typed wind speed and a meter reading are not equivalent
for an audit. FieldLog flags absence of the source as
`NEEDS_REVIEW`/`unknown`, not as a regulatory failure.
**Edge cases / nuance:**
- Auto-fetched weather (`weatherSnapshot.source`) satisfies this without a
  separate manual entry.
- "Manual" is itself an acceptable answer — the rule wants the *answer*, not
  a specific source type.

## #50 — Weather capture timestamp recorded
**Rule ID (code):** `WEATHER_CAPTURE_TIMESTAMP_UNKNOWN`
**Source tags:** `FIELDLOG_OPERATIONAL`
**Citation short:** *(FieldLog operational — not a regulatory requirement)*
**Citation (verbatim):** [No verbatim regulatory text — operational evidence-quality flag.]
**Rationale:** A weather reading without a capture timestamp drifts from the
application time and loses evidentiary weight; an inspector cannot confirm
the reading reflects conditions during application. FieldLog flags absence
for review.
**Edge cases / nuance:**
- The application start/end time (#17/#18) is not a substitute — those are
  the operator's work window, not the moment the weather reading was taken.
- Auto-fetched snapshots carry a `capturedAt` that satisfies this.

## #51 — Weather capture location recorded
**Rule ID (code):** `WEATHER_CAPTURE_LOCATION_UNKNOWN`
**Source tags:** `FIELDLOG_OPERATIONAL`
**Citation short:** *(FieldLog operational — not a regulatory requirement)*
**Citation (verbatim):** [No verbatim regulatory text — operational evidence-quality flag.]
**Rationale:** Weather varies by location; a reading from a station 30 miles
away is weak evidence of conditions in the field. FieldLog flags absence of
a location association — coordinates, station ID, or site name — for review.
**Edge cases / nuance:**
- An auto-fetch snapshot's `stationId` satisfies this.
- "Site" is an acceptable answer for manual entry when no precise
  coordinates are available, though precision is better.

## #72 — GPS / location evidence captured
**Rule ID (code):** `GPS_EVIDENCE_UNKNOWN`
**Source tags:** `FIELDLOG_OPERATIONAL`
**Citation short:** *(FieldLog operational — exceeds 2 CSR 70-25.120 baseline)*
**Citation (verbatim):** [No verbatim regulatory text — Missouri's record does not require GPS coordinates; field (E) accepts "address or brief description." FieldLog adds GPS as evidence quality.]
**Rationale:** 2 CSR 70-25.120(4)(E) requires the address of the application
site *or* a brief description; GPS coordinates are not strictly required.
FieldLog still flags GPS absence for review because a coordinate pair (or a
field polygon) is by far the strongest evidence of *where* the application
happened, and is operationally cheap to capture on a mobile device.
**Edge cases / nuance:**
- A record with a populated site address (#21) and description (#22) is
  Missouri-compliant on this point even without GPS — this rule is purely an
  evidence-quality flag, not a blocker.
- Field polygons (future enhancement) would supersede a single GPS point.

---

# Notes for code integration

Where multiple matrix items collapse into a single `ruleId` in the current
code, this doc notes the cross-walk explicitly (e.g. #56 currently covered by
`LABEL_NOT_ATTACHED` rather than a standalone rule). Where the matrix item is
purely a classification gate for other rules (e.g. #41 is the boolean that
turns on #42 / #43) and has no standalone `ruleId`, that's flagged in the
section.

The citation field on each rule module currently carries a paraphrased
citation (the same paraphrased text used in this doc's Rationale). If a future
build adds verbatim Missouri statute / regulation text to the repo (e.g. a
`research/regulatory/2_CSR_70_25_120.txt` extract), the **Citation (verbatim)**
fields in this doc should be filled in and the rule modules' `citation` fields
updated to point at the verbatim source — leaving the `citationShort` and
Rationale alone.
