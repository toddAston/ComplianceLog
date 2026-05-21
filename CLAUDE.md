# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project
FieldLog (repo: ComplianceLog) — mobile-first, offline-capable pesticide application recordkeeping for agricultural operations.

# Mission
Offline-first immutable pesticide application evidence capture system.

# Project Status
v0.1 — Vite + React + TypeScript app scaffolded and running with Dexie/IndexedDB persistence, MUI UI, Zod schemas, and a vitest suite covering the golden path (draft → submit → product snapshot → manager review → lock → export) plus compliance checks, sync status, and audit timeline. A **Fastify + Drizzle + Postgres + Redis + BullMQ server skeleton** lives at `server/` (committed at `301af2a`) but is **not deployed and not yet talking to the client** — see "Backend State" and "Known Contract Mismatches" below. All client persistence today is still local to the browser, and all role gating is client-side (see "Trust Boundary" below). The design docs (below) remain the source of truth for product intent; when they disagree with the code, flag the divergence rather than silently aligning the docs.

# Source-of-Truth Documents
Read these before designing or implementing — they define the domain and are more complete than the code:
- `docs/product/fieldlog_design_model_v0_1.json` — canonical form fields, controls, required rules, workflow/sync statuses, domain model, v0.1 table list.
- `docs/architecture/reproducible-design/fieldlog_reproducible_design_v0_1.md` — full design snapshot with field-level tables.
- `docs/architecture/diagrams/fieldlog_mermaid_diagrams_v0_1.mmd` — golden path flowchart, lifecycle state diagram, ERD.
- `docs/domain/examples/application_record_v01.json` — example record instance.
- `FieldLog Development Blueprint.md` (root) — regulatory analysis and feature design.
- `research/regulatory/` — Missouri/EPA source PDFs (APPRIL guides, RUP report). Do not commit derived/large data files into the repo (`data/raw/epa/apprildatadump_public.xlsx` is gitignored at 98 MB).

When the design docs and the code disagree, the docs win — flag the divergence rather than silently aligning the docs to the code.

# Product Constraints
- Mobile-first
- Offline-first
- Contractors submit immutable records
- Managers review/lock but do not silently alter submissions
- NOT a legal authorization engine — captures evidence, does not adjudicate compliance
- Preserve chain of custody

# Tech Stack
- Vite + React + TypeScript (not yet scaffolded)
- MUI for UI controls (the design model specifies MUI control names per field, e.g. Autocomplete, DatePicker)
- Dexie / IndexedDB for offline persistence
- React Hook Form for form state
- Zod for schema validation
- Vitest + @testing-library/react + jsdom (already installed)

# Architecture Rules
- Domain-first organization (folders by domain, e.g. `application-record/`, `product-catalog/`, not by tech layer).
- No direct IndexedDB / Dexie calls from UI components — go through a service layer.
- Service layer mediates persistence and is the only place that touches Dexie.
- Zod schemas are the source of truth — derive TS types from Zod, not the other way around.
- Immutable event-append model preferred for record history. The lifecycle is `Draft → Submitted → PendingReview → (Accepted | NeedsCorrection) → Locked → Exported`; corrections re-enter Draft. Status transitions should be appended as events on `application_record_events`, not mutate prior state.
- A submitted Application Record carries a **Product Snapshot** (frozen copy of the product/EPA reg # at submit time) so a later catalog update cannot retroactively alter what was applied.
- Sync status is independent of workflow status (`Local Only | Queued | Syncing | Synced | Sync Failed`).

# Coding Rules
- Minimal diffs. Reuse existing patterns before introducing abstractions.
- No unnecessary dependencies; no massive refactors unless requested.
- Default to no comments; only add a comment when the *why* is non-obvious.

# Current MVP Goal
Golden path:
draft → submit → product snapshot → manager review → lock → export

# Trust Boundary: When a Backend Lands
Today the client runs entirely in the browser and does not talk to the server skeleton at `server/`. There is no real auth, no client→server requests in flight, and no SQL going through any production query path. That means the following are **demo-grade only** and MUST be re-enforced server-side once the client starts hitting the real API — and they MUST be implemented in the server before any production deployment:

- **Role gating** (`useSessionRole`, `SessionProvider`, `DEMO_APPLICATOR_ACTOR` / `DEMO_MANAGER_ACTOR`) is a client-side toggle and is trivially bypassable. Treat it as UI scaffolding, not as authorization.
- **Zod schemas in `src/domain/schemas.ts`** validate user input on the client only. When a backend exists, the same schemas (or their server-side equivalents) MUST be re-applied at the API boundary — never trust a payload because the UI is "supposed to" have validated it.
- **Lifecycle invariants** (immutability after `locked`, append-only `recordEvents`, `productSnapshot` is frozen at submit, sync status independent of workflow status) are enforced by the service layer in `src/application/*`. The server must enforce these same invariants — the client can be replaced or tampered with.
- **`inviteToken` in `contractorService.ts`** is a locally-generated UUID for stub display links. If invite flows become real auth artifacts, the token generator, expiry, and revocation store must move server-side and the strength must be reviewed.
- **Error messages from services** are surfaced verbatim to the UI today. When wired to a real API, server error responses must not leak internal details (stack traces, raw DB errors) — keep client-side `err.message` passthrough on the client side of the boundary only.
- **Rate limiting, password hashing (bcrypt/argon2), authorization checks on every endpoint, and parameterized queries** are all "N/A today, mandatory the moment a backend exists."

When adding any feature that *would* hit a backend in production, write it so the server boundary is obvious in the code (a dedicated service function, a typed request/response shape) — don't smear the contract across UI components.

# Backend State (as of 2026-05-20)
A Fastify + Drizzle + Postgres + Redis + BullMQ server skeleton lives at `server/` (committed at `301af2a`). It is **not deployed** and the client does not yet talk to it. Its purpose is to give the client sync layer (in progress, partly uncommitted — see `HANDOFF.md`) a real contract to target. `cd server && npx vitest run` passes (31 tests); `docker compose up` is written but Docker hasn't been verified on this machine.

What exists today:
- **Drizzle schema** (`server/src/db/schema.ts`) — PG enums derived from client Zod (`workflow_status`, `sync_status`, `rup_status`, `review_status`, `record_event_type`, `user_role`) so the two cannot drift on enum values. Tables: orgs, users, farms, fields, applicators, products, application_records, product_snapshots, reviews, append-only record_events. Append-only and locked-immutability triggers in `migrations/0001_*.sql`.
- **Two routes** in `server/src/routes/records.ts`: `POST /v1/application-records` (create) and `POST /v1/application-records/:recordId/submit` (submit). The submit handler re-runs `runAllComplianceChecks` server-side (imported from the client app via `complianceRules.ts`, which re-exports `src/application/compliance/*`).
- Auth stub (`server/src/plugins/auth.ts`), error envelope, lifecycle assertion helpers, type-coercion mapping in `server/src/lib/mapping.ts`.

What does NOT exist yet (relative to `docs/architecture/api/client_migration_notes.md`): review, resubmit, sync/batch, export job, exports/{jobId}, applicators, farms, fields, auth/login, auth/refresh, all GET list endpoints.

# Known Contract Mismatches
The client's `src/domain/schemas.ts` has been actively expanded (matrix #1-72 compliance fields) while the server's Drizzle schema, openapi spec, and route mappers are still at the **v0.1 shape committed at `213ff4c`**. The compliance matrix expansion is uncommitted in the working tree — when it lands, every layer below needs to bump in lockstep or matrix data will silently disappear at the network boundary.

1. **Silent matrix-field drop on submit/read (severity: critical).** The server's `createBodySchema` parses the full client `contractorInputsSchema` (so requests don't reject — `.optional()` fields pass through), but `server/src/routes/records.ts` `insertRow` mapping writes only v0.1 columns. The 30+ new client fields (`requesterName`, `requesterAddress`, `siteAddress`, `siteDescription`, `areaTreatedValue`, `areaUnit`, `applicatorCategory`, `noncertifiedApplicatorName` + license/technician/trainee fields, `slnNumber`, `lessThanLabelConcentration` + producer-request fields, `mixtureRate`/`totalMixtureAmount`/`applicationRateValue`/`rateUnit`, `isPremixed`/`premixedAmountUsed`/`premixedActualRate`, `structuralTermiteWithin10ft`, `indoorSpotCrackCrevice`, `weatherCaptureSource`/`Timestamp`/`Location`, `gpsLatitude`/`gpsLongitude`, `productLabelRef`/`labelVersionOrDate`, all 8 `label*Reviewed` acks, `tankMixProducts` array, supervisorIdentified + workOrder/labelInPossession/equipmentReadiness acks, `epaRegistrationCorrelationEvidenceId`, `siteType`) are **silently dropped**. `rowToApplicationRecord` likewise reads back without them. Server-side compliance evaluation diverges from client-side because the row passed to `runAllComplianceChecks` is missing the new fields, so the server's gate could pass a record the client failed (or vice versa).
2. **OpenAPI spec lags client schema.** `docs/architecture/api/openapi.yaml` contains zero matrix-field names — it documents the v0.1 wire shape only. Same v0.1-shape footprint as the Drizzle schema.
3. **Route-prefix drift.** Routes are declared at `/v1/application-records` (with `/v1/` literally in each route string), but `docs/architecture/api/openapi.yaml` paths and `docs/architecture/api/client_migration_notes.md` use unprefixed paths. Either add a global `/v1` plugin and drop per-route prefixes, or update the spec/docs to match.
4. **Missing endpoint surface (expected for a skeleton, but a real gap).** See the "What does NOT exist yet" list above; until those land, the client sync layer can only exercise create+submit.

When working on the sync layer or any feature that crosses the network boundary, treat the four layers — **client Zod (`src/domain/schemas.ts`), openapi spec (`docs/architecture/api/openapi.yaml`), server Drizzle (`server/src/db/schema.ts`), and server route mappers (`server/src/routes/*.ts`)** — as a single contract that must move together.

# Dexie Schema Upgrades
IndexedDB schema migrations are forward-only by Dexie's design — there is no rollback once a user's browser has run `db.version(N).stores(...)`. The current schema is `v1` in `src/db/fieldlogDb.ts`. Rules:

- **Additive changes are cheap.** New tables, new indexes, and new optional fields on existing records don't require a version bump's worth of care — bump the version, declare the new stores, and existing rows are read back transparently because Dexie stores rows as opaque JSON.
- **Renames, drops, and required-field additions need an upgrade function.** Use `db.version(N).stores({...}).upgrade(async (tx) => { ... })` to backfill or transform existing rows in the same transaction. Never assume the old schema is gone — users on stale tabs may still write under v(N-1).
- **Breaking changes need an export-before-upgrade path.** If a migration cannot be done in-place (e.g., splitting a column, changing primary keys), the app must offer the user a JSON export of their existing records before bumping the version, and must surface an explicit "your local data was migrated / could not be migrated" status — silent data loss is unacceptable for an evidence-capture product.
- **Every schema bump needs a test.** Open the DB at the prior version with a seeded row, then re-open at the new version and assert the row survives (or migrates) as expected. `fake-indexeddb` is already a dev dependency for this.
- **The server is the long-term durability story, not Dexie.** Once sync exists, the local DB is a cache, not the system of record — but until then, treat schema bumps as one-way doors and act accordingly.

# Commands
No build/lint/dev scripts are defined yet — `package.json` only declares vitest devDependencies. When scaffolding Vite, add the standard scripts (`dev`, `build`, `preview`, `test`, `lint`, `typecheck`) under `scripts`.

Once vitest is wired up:
- Run all tests: `npx vitest`
- Run a single test file: `npx vitest run path/to/file.test.ts`
- Run tests matching a name: `npx vitest -t "pattern"`
- Watch mode: `npx vitest` (default) — single-run with `npx vitest run`.

# Git / Repo Conventions
- Default branch is `main`. Remote is `origin` → `https://github.com/toddAston/ComplianceLog`.
- The 98 MB EPA xlsx (`data/raw/epa/apprildatadump_public.xlsx`) is gitignored intentionally; if a similar large file appears, gitignore it rather than committing.
- `package-lock.json` is tracked for reproducible npm installs. `yarn.lock` and `pnpm-lock.yaml` remain gitignored unless the package manager changes.
