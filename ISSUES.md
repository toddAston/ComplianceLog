# FieldLog Issue Log

This is a honest accounting of what is broken, incomplete, or wrong in the codebase as of 2026-05-21.
FieldLog is not a polished product. It is a compliance-first evidence log built to capture pesticide
application records accurately and traceably — nothing more. This file exists because the gap between
"it looks like it works" and "it actually works correctly under regulation" needs to be visible, not buried.

No issue is softened. No gap is deferred with vague language. If something is critical and unimplemented,
it says so. If a regulatory citation is wrong in the code, it says which line is wrong and what the
correct citation is. This project values accurate recordkeeping over the appearance of completeness —
that standard applies to the issue log too.

Generated 2026-05-21 via automated multi-agent audit. Covers five domains:
contract mismatches, compliance engine gaps, architecture invariants, test coverage, and DB/backend skeleton.

Status legend: `open` · `in-progress` · `done`

---

## CONTRACT — Client / Server / OpenAPI mismatches

| ID | Sev | Status | Summary |
|----|-----|--------|---------|
| CM-001 | critical | open | `applicatorSchema` 8 fields missing from Drizzle `applicators` table |
| CM-002 | high | open | `applicationRecord.syncError` has no `sync_error` column server-side |
| CM-003 | high | open | `applicationRecord.lastSyncedAt` has no `last_synced_at` column server-side |
| CM-004 | high | open | `licenseCategoryCodeSchema` and `noncertifiedRupTrainingTypeSchema` are Zod-only — no `pgEnum`, no Drizzle column |
| CM-005 | high | open | `systemCatalogVersion` column exists in Drizzle but `insertRow` never writes it; `rowToApplicationRecord` reads back `undefined` always |
| CM-006 | high | open | Route `/v1/` prefix hard-coded in 21 route strings; OpenAPI compensates via `servers.url` — brittle; generated clients will break |
| CM-007 | high | open | CLAUDE.md "Known Contract Mismatches" §1 is stale — claims matrix fields are dropped server-side, but they are present; misleads future developers |
| CM-008 | medium | open | `applicationRecord.serverShadow` defined in Zod; no Drizzle column |
| CM-009 | medium | open | `product.activeIngredient` and `product.manufacturer` defined in Zod; no Drizzle columns |
| CM-010 | medium | open | `reviews.reviewedByUserId` FK column in Drizzle has no wire representation in `applicationReviewSchema` |
| CM-011 | medium | open | `productSnapshots.organizationId` required in Drizzle but absent from `productSnapshotSchema` and OpenAPI |
| CM-012 | medium | open | Three `contractorInputs` supervision fields (`supervisorPhoneAvailable`, `supervisorOnSiteIfLabelRequires`, `workOrderMinimumContentVerified`) added client-side without Drizzle column, migration, or mapper update |
| CM-013 | medium | open | `serverSchemas.ts` file referenced in `client_migration_notes.md` for server-only fields does not exist |
| CM-014 | low | open | `rup_status` enum values `yes`/`no` are unquoted in `openapi.yaml` — YAML 1.1 parsers interpret them as booleans |
| CM-015 | low | open | `weatherSnapshot` and `tankMixProducts` read from DB via TypeScript cast only — no runtime Zod re-parse; invalid stored JSON silently accepted |
| CM-016 | low | open | `/healthz`/`/readyz` live at root but `servers.url` is `.../v1`; strict OpenAPI clients resolve them as `/v1/healthz` |
| CM-017 | high | open | `etag` on create relies solely on Drizzle column default (`defaultRandom()`); `insertRow` never sets it explicitly — silent breakage if default is ever dropped |

**CM-001 detail:** Missing fields: `emailAddress`, `phoneNumber`, `defaultApplicatorCategory`, `licenseExpiryDate`, `notes`, `licenseCategoryCodes`, `noncertifiedRupTrainingType`, `noncertifiedRupTrainingDate`. These include the foundation for the §.010(3)(C)(1) supervisor-certified-in-category rule.
Files: `src/domain/schemas.ts:187-209`, `server/src/db/schema.ts` (applicators table)

---

## COMPLIANCE — Engine rule and citation gaps

### Missing rules

| ID | Sev | Status | Matrix # | Regulatory ref | Summary |
|----|-----|--------|----------|---------------|---------|
| CE-001 | critical | open | #9 | 2 CSR 70-25.120(4)(A) | No rule requires certified applicator license number on every applicable record |
| CE-002 | high | open | #28 | 2 CSR 70-25.120(4)(G) | `cropVariety` field doesn't exist in schema and no rule covers it |
| CE-003 | high | open | #31 | 2 CSR 70-25.120(4)(I) | No rule checks whether product trade name came from catalog vs. free-text entry |
| CE-004 | high | open | #41 | 2 CSR 70-25.120(4)(L) | No `NEEDS_REVIEW` rule when `isPremixed` is undefined — silently passes |
| CE-005 | high | open | #44 | 2 CSR 70-25.120(4)(M) | No rule for outdoor application flag; unknown `siteType` silently defaults to outdoor |
| CE-006 | high | open | #52 | 2 CSR 70-25.120(4)(N) | No `NEEDS_REVIEW` rule when `lessThanLabelConcentration` is unset — silently passes |
| CE-007 | high | open | #56 | FIFRA §3 | `SOURCE_UNAVAILABLE` result code declared in `types.ts` but never emitted; no standalone rule for product registration / label source |
| CE-008 | high | open | #75 | FIELDLOG_CHAIN_OF_CUSTODY | No rule enforces original submission immutability post-submit |
| CE-009 | high | open | #76 | FIELDLOG_CHAIN_OF_CUSTODY | No rule checks correction records have linked original + reason |
| CE-010 | high | open | #77 | FIELDLOG_OPERATIONAL | No rule emits `NEEDS_REVIEW` when `managerInputs.reviewStatus === "not_reviewed"` |
| CE-011 | high | open | #78 | FIELDLOG_OPERATIONAL | No rule requires manager review note when approving with an active warning |
| CE-012 | high | open | #79 | FIELDLOG_CHAIN_OF_CUSTODY | No rule checks event timeline completeness |
| CE-013 | high | open | #80 | FIELDLOG_OPERATIONAL | `SOURCE_UNAVAILABLE` reserved but never emitted at runtime; no runtime source-citation enforcement |
| CE-014 | high | open | #81 | FIELDLOG_OPERATIONAL | No rule checks audit export contains source-linked checklist |
| CE-015 | high | open | #82 | FIELDLOG_OPERATIONAL | No rule checks disclaimer is included in export |

**Note on CE-008 through CE-015:** All matrix #75–#82 are marked P0 in `docs/build/compliance checks.md` and have zero rule implementations. The chain-of-custody and export-completeness subsection is entirely unimplemented.

### Wrong citation subsections

| ID | Sev | Status | File:approx-line | Rule / result code | Stated | Should be |
|----|-----|--------|------------------|--------------------|--------|-----------|
| CE-016 | medium | open | `rules/requiredFields.ts:71` | `MISSING_AREA_TREATED` | `(D)` | `(F)` |
| CE-017 | medium | open | `rules/requiredFields.ts:79` | `MISSING_CROP_OR_SITE` | `(E)` | `(G)` |
| CE-018 | medium | open | `rules/requiredFields.ts:89` | `MISSING_PRODUCT_NAME` | `(F)` | `(I)` |
| CE-019 | medium | open | `rules/requiredFields.ts:99` | `MISSING_EPA_REG` | `(F)` | `(J)` |
| CE-020 | medium | open | `rules/requiredFields.ts:119` | `MISSING_RATE_OR_AMOUNT` | `(G)` | `(K)` |
| CE-021 | medium | open | `rules/applicatorCategory.ts:107` | Multiple rules | `2 CSR 70-25.120(B)` | `2 CSR 70-25.120(4)(B)` (paragraph omitted) |

### Logic gaps

| ID | Sev | Status | File:approx-line | Summary |
|----|-----|--------|------------------|---------|
| CE-022 | medium | open | `rules/requiredFields.ts:69` | `MISSING_AREA_TREATED` fires even when `indoorSpotCrackCrevice` exemption is intentionally chosen |
| CE-023 | medium | open | `rules/applicatorCategory.ts:69` | `NONCOMMERCIAL_PUBLIC_RUP_DUTY` silently skips unknown RUP state instead of deferring to `LABEL_VERIFICATION_REQUIRED` |
| CE-024 | low | open | `rules/conditionalApplicability.ts:47` | `SLN_NUMBER_NOT_CONFIRMED` accepts empty string — conflates "no SLN" with "forgot field" |
| CE-025 | low | open | `rules/conditionalApplicability.ts:70` | `EPA_CORRELATION_EVIDENCE_PARTIAL` trigger is brittle (checks `undefined`, not empty string) |
| CE-026 | low | open | `rules/tankMix.ts:42` | `TANK_MIX_MISSING_EPA` doesn't honor correlation-evidence substitution (#34) |
| CE-027 | low | open | `src/domain/schemas.ts:81` | `tankMixProductSchema` lacks per-product `epaRegistrationCorrelationEvidenceId` and `slnNumber` fields |

---

## ARCH — Architecture invariant violations

| ID | Sev | Status | File:line | Summary |
|----|-----|--------|-----------|---------|
| AR-001 | high | open | `src/ui/session/SessionContext.tsx:112,155` | Role gating is client-only (localStorage + React state); no service function inspects role. **Documented gap** — must be re-enforced server-side before production. |
| AR-002 | high | open | `src/application/contractorService.ts:88` | Invite token (`crypto.randomUUID()`) is returned but never persisted — no lookup table, no expiry, no revocation path. **Documented gap** — must move server-side if invite flows become real auth. |
| AR-003 | medium | open | `src/application/applicationRecordService.ts:272` | Chain-of-custody "heal" mutates `contractorInputs` on a locked record path without appending a corresponding audit event — violates the append-only model. |
| AR-004 | medium | open | `src/application/sync/syncService.ts:96,152,171` | `adoptServerRecord` and `retryRecordSync` overwrite local records without checking `workflowStatus === "locked"`; a server response could retroactively replace a locally-locked record. |
| AR-005 | medium | open | `src/application/sync/httpTransport.ts:39,43` | `body.error.message` from server response is embedded verbatim into a thrown `Error` and bubbles to UI via `useSyncFlush` — server stack traces or raw DB errors would be displayed to users once the real API lands. |
| AR-006 | medium | open | `src/application/sync/useSyncFlush.ts:66` | Surfaces transport-thrown error messages verbatim to the UI; chains from AR-005. |
| AR-007 | low | open | `src/application/nwsWeatherAdapter.ts:193` | Raw `fetch` error text (CORS/DNS messages) returned in `message` field and surfaced to UI. |
| AR-008 | low | open | `src/application/geolocation.ts:85` | `GeolocationPositionError.message` passed through unsanitized. |

---

## TEST — Coverage gaps

| ID | Sev | Status | File | Summary |
|----|-----|--------|------|---------|
| TC-001 | medium | open | `src/application/sync/httpTransport.ts` | Production HTTP sync transport has no tests; wire-format bugs, retry policy, and error mapping are unverified |
| TC-002 | medium | open | `src/application/sync/useSyncFlush.ts` | React hook driving "Sync now" UX has no isolated tests (debounce, error surfacing, mount/unmount) |
| TC-003 | low | open | `src/application/sync/defaultTransport.ts` | Transport-selector logic (loopback vs. HTTP) has no tests |
| TC-004 | low | open | `src/ui/pages/DashboardPage.tsx` | No test file |
| TC-005 | low | open | `src/ui/pages/SettingsPage.tsx` | No test file |
| TC-006 | low | open | `src/ui/pages/SignupPage.tsx` | No test file (Login and InviteAccept are tested; signup is the gap) |
| TC-007 | low | open | `server/src/routes/records.test.ts:99` | Fake Drizzle `db` ignores `where()` filters — multi-record tests (org-scoping, ownership) would silently pass; promote to integration tests before adding those scenarios |

---

## DATA — DB, seed, and backend skeleton gaps

| ID | Sev | Status | File:approx-line | Summary |
|----|-----|--------|------------------|---------|
| DA-001 | high | open | `HANDOFF.md` | **Uncommitted Phase 1 sync work sitting in working tree** — large body of finished work at risk of accidental loss via `git reset/stash/checkout`. Commit before any other changes. |
| DA-002 | high | open | `src/db/seedDemoRecords.ts:189,197,205` | Three demo records reference product `rup-279-3069` which does not exist in `seedRupProducts.ts`; product hydration will fail on reseed |
| DA-003 | medium | open | `src/db/fieldlogDb.ts` | No Dexie index on `applicators.licenseCategoryCodes` (multi-entry array); required for the §.010(3)(C)(1) category-match rule |
| DA-004 | medium | open | `src/db/fieldlogDb.ts` | No Dexie index on `applicators.noncertifiedRupTrainingDate`; retraining-expiry queries require full scan |
| DA-005 | medium | open | `src/db/fieldlogDb.ts` | No Dexie indexes on `applicationRecords` for `contractorInputs.applicatorId`, `farmId`, or `fieldId`; list filtering requires full scans |
| DA-006 | medium | open | `server/src/routes/records.ts` | `Idempotency-Key` header is checked for presence but replay store is not implemented — retries duplicate product snapshots and record events |
| DA-007 | medium | open | `server/src/db/schema.ts:362` vs `server/migrations/0001_initial_schema.sql:199` | `app_records_locked_forward_only` CHECK constraint name and predicate diverge between Drizzle and SQL (SQL also covers `exported` state; Drizzle does not) — `drizzle-kit generate` produces a diff on every run |
| DA-008 | medium | open | `server/src/db/schema.ts` | `product_snapshot_id` FK exists in SQL migration but is invisible to Drizzle — will be silently dropped on `drizzle-kit generate` |
| DA-009 | low | open | `server/migrations/0001_initial_schema.sql` | Append-only trigger (`record_events_no_update_delete`) and lifecycle trigger (`application_records_lifecycle`) live only in hand-written SQL; `drizzle-kit generate` silently drops them on regen |
| DA-010 | low | open | `src/db/seedRupProducts.ts:27,258` | `RupFamily` enum includes `"fungicide"` but seed has 0 matching entries; `rupIdsByFamily("fungicide")` returns `[]` — callers assuming non-empty silently get nothing |
| DA-011 | low | open | `eslint.config.js` | `eslint .` crashes repo-wide because it walks `reference/vendor-docs/`; workaround is lint by path. Fix: add `reference` and `server` to `globalIgnores` |
| DA-012 | low | open | `server/src/routes/stub.ts` | No invite-redemption endpoint (`POST /auth/accept-invite` or equivalent) to validate the token generated in `contractorService.ts` |

---

## Severity summary

| Severity | Contract | Compliance | Architecture | Tests | Data | Total |
|----------|----------|------------|--------------|-------|------|-------|
| critical | 1 | 1 | — | — | — | **2** |
| high | 7 | 15 | 2 | — | 2 | **26** |
| medium | 5 | 8 | 4 | 2 | 5 | **24** |
| low | 4 | 4 | 2 | 5 | 5 | **20** |
| **total** | **17** | **28** | **8** | **7** | **12** | **72** |

## Recommended first actions

1. **DA-001** — Commit the uncommitted Phase 1 sync work immediately before anything else.
2. **CE-001 + CE-016–CE-021** — Certified applicator license rule is missing (critical P0) and 6 existing rules cite the wrong regulatory paragraph.
3. **CM-001** — Add 8 applicator fields to Drizzle `applicators` table + migration; this also unblocks the §.010(3)(C)(1) supervisor rule.
4. **AR-003 + AR-004** — Append a heal event on the chain-of-custody repair path; add an explicit `locked` guard in the sync reconciliation path.
5. **CM-007** — Update CLAUDE.md "Known Contract Mismatches" §1 (it's stale and actively misleads).
