# API Specification Handoff Prompt

Use this prompt to generate the complete server-side API specification for FieldLog. Hand it to a fresh agent (or a backend partner) along with read access to this repo. The output is a deliverable, not a conversation — the agent should produce concrete artifacts, not ask the user to make every decision.

---

## Role

You are a senior backend architect picking up FieldLog after the offline-only v0.1 client has shipped. Your job is to design and document the complete HTTP API that the existing React/Dexie client will sync against, and that the future contractor mobile app and manager web app will both consume. This is a clean-slate server design — no legacy endpoints to preserve — but the client's domain model, lifecycle, and invariants are non-negotiable inputs.

## Mission

FieldLog captures pesticide application records as **legally-defensible, immutable evidence** under Missouri 2 CSR 70-25.120 and equivalent state rules. The system is not a legal authorization engine; it captures what was done, by whom, when, where, and with what product, and freezes a Product Snapshot at submit time so the catalog cannot retroactively rewrite history. Chain of custody is the product. Treat every design choice through that lens — if a feature could let a record be silently altered after lock, it is wrong.

## Required Reading Before You Design Anything

These exist in the repo. Read them in this order:

1. `CLAUDE.md` — project rules, trust boundary, current scaffold state.
2. `docs/product/fieldlog_design_model_v0_1.json` — canonical fields, controls, required rules, workflow/sync enums.
3. `docs/architecture/reproducible-design/fieldlog_reproducible_design_v0_1.md` — full design snapshot.
4. `docs/architecture/diagrams/fieldlog_mermaid_diagrams_v0_1.mmd` — golden-path flow, lifecycle state machine, ERD.
5. `docs/domain/examples/application_record_v01.json` — example record.
6. `src/domain/schemas.ts` — the **authoritative** Zod schemas; your OpenAPI schemas must be structurally compatible with these (field-for-field, enum-for-enum).
7. `src/domain/types.ts` — derived TS types (do not duplicate; reference the Zod source).
8. `src/db/fieldlogDb.ts` — current Dexie tables and indexes; mirror the resource set 1-to-1 unless you have a documented reason to deviate.
9. `src/application/*` — service layer; the API verbs must cover every public function exported here (`createDraftApplicationRecord`, `submitApplicationRecord`, `requestCorrectionForApplicationRecord`, `acceptAndLockApplicationRecord`, `simulateSyncAllQueued`, `exportLockedApplicationRecord`, `runAllComplianceChecks`, contractor/applicator/farm/field/product CRUD, etc.).
10. `FieldLog Development Blueprint.md` — regulatory analysis and rationale.

If anything in the spec you produce diverges from these sources, flag it explicitly in a "Divergences from v0.1 client" section with the reason — don't silently realign.

## Hard Constraints

These are not negotiable. Echo them back at the top of your spec.

1. **No hardcoded secrets.** Every secret comes from environment variables; every env var has a placeholder in a server-side `.env.example`.
2. **Server-side validation on every endpoint.** Re-validate every payload with the existing Zod schemas (`src/domain/schemas.ts`) at the API boundary — these schemas are the source of truth and must be imported into the server, not re-typed. Trust nothing from the client. Document where each request body is validated and against which schema.
3. **Postgres + Drizzle ORM.** The server database is **Postgres 16+** (locked, not "unless justified otherwise"). The ORM is **Drizzle** — chosen because (a) it lets the existing Zod schemas drive validation via `drizzle-zod`, preserving the "Zod is source of truth" rule from CLAUDE.md; (b) its schema is plain TypeScript so the migration tool and the runtime see the same types; (c) it stays close to SQL, which matters for the triggers and `jsonb` operators we need. No raw string concatenation into SQL. If you need a query Drizzle can't express, use its `sql\`...\`` tagged template with bound parameters, never interpolation.
4. **Auth on every endpoint.** Every endpoint declares: (a) authentication required? (b) which roles? (c) which org scope? (d) which record-level ownership check? "Public" endpoints must be called out and justified.
5. **Auth endpoints are rate-limited.** Document the rate-limit policy (per IP, per user, per token), the storage backend (Redis, etc.), and the 429 response shape.
6. **Passwords hashed with argon2id (preferred) or bcrypt.** Never plaintext, never reversible encryption, never SHA-family-only. Document the work-factor / memory-cost parameters and the rotation plan.
7. **Error responses don't leak internals.** No stack traces, no raw SQL errors, no ORM internals. Define a uniform error envelope (`{ error: { code, message, requestId } }`) and a mapping from internal exceptions to safe public codes.
8. **Migrations are reversible.** Every database migration has both `up` and `down`. Document the migration tool, the naming convention, and the deploy-time policy (e.g., "no destructive `down` runs in prod without a manual override").
9. **Long-running work goes in background jobs.** PDF export, sync reconciliation, email/SMS, large catalog imports — all must run in a job queue, not in the request handler. Document the queue (BullMQ / Sidekiq / Cloud Tasks / SQS / etc.), retry policy, dead-letter handling, and how the client polls or subscribes for completion.
10. **Immutability after `locked`.** Once `workflowStatus = locked`, the server must reject every mutation to `contractorInputs`, `managerInputs`, `productSnapshot`, and `system` (except append-only `recordEvents` of type `exported`). Encode this as a database-level constraint or trigger where possible, not just an application-layer check.
11. **Append-only audit log.** `recordEvents` is append-only. No `UPDATE` or `DELETE` on that table for any user-facing endpoint. Document how administrative corrections (if any) are journaled.
12. **Product Snapshot is frozen at submit.** The snapshot row is written in the same transaction as the `draft → submitted` transition and is never updated thereafter.
13. **Tenant isolation.** Every row belongs to an `organizationId`. Every query filters by the caller's org. Cross-tenant access is an auth bug, not a feature.
14. **Flatten known fields, `jsonb` only for open-ended bags.** Every field with a fixed shape in `src/domain/schemas.ts` becomes a real Postgres column with real types, constraints, and indexes — `workflow_status`, `sync_status`, `organization_id`, `application_date` (`date`), `epa_registration_number` (`text` with a CHECK), `rup_status` (enum), `acres_treated` (`numeric`), `created_at` (`timestamptz`), etc. Reserve `jsonb` for genuinely open-ended payloads: `record_events.metadata`, `contractor_inputs.weather_snapshot` (third-party shape may evolve), future audit context. Do not store an entire application record as one `jsonb` blob — the law cares about specific fields and the database should too. Where a `jsonb` column has a stable shape internally (e.g., `weather_snapshot`), add a CHECK constraint with `jsonb_typeof` or a Zod-validated insert path, and document the contract.

## Deliverables

Produce **all** of the following. Filenames are suggestions; keep them under `docs/architecture/api/`.

### 1. `openapi.yaml` — OpenAPI 3.1 specification

A single, lint-clean OpenAPI 3.1 file covering every endpoint. Requirements:

- **Components/schemas** are derived from `src/domain/schemas.ts`. Use `$ref` aggressively — no inline duplication of record shapes. Where the server adds fields the client doesn't have (e.g., `serverId`, `etag`, `createdByUserId`), document why.
- **Every endpoint** has: summary, description, tags, parameters, request body schema, all response codes (including 400/401/403/404/409/422/429/500), security requirements, rate-limit headers, idempotency-key header where applicable.
- **`security`** is declared globally and overridden per-endpoint only when an endpoint is intentionally unauthenticated. The default is authenticated.
- **Examples** are real, not placeholder — pull from `docs/domain/examples/application_record_v01.json` where possible.
- **No `additionalProperties: true` on request bodies** — strict validation only.

### 2. `api_architecture.md` — written architecture document

Sections, in order:

1. **Stack details.** The stack is fixed: **Node 22+ LTS / TypeScript / Fastify / Drizzle ORM / Postgres 16+ / BullMQ on Redis** for background jobs. Your job in this section is not to re-pick the stack; it's to (a) explain how Drizzle schemas are derived from or co-defined with the existing Zod schemas (recommend `drizzle-zod` for schema → Zod inference, or a hand-written mapping if Zod stays canonical — pick one and justify), (b) describe the project layout (`/src/domain` shared with the client? a private npm package? a monorepo?), (c) list the production dependencies with pinned major versions, and (d) name the hosting target (Fly.io / Railway / AWS ECS / GCP Cloud Run — pick the simplest one that meets the rate-limiting + Redis + Postgres requirements and justify in one paragraph).
2. **Authentication & session model.** Cookie session vs. JWT vs. opaque bearer token. Refresh-token rotation, revocation list, multi-device behavior, "remember me" semantics, MFA roadmap (does v1 ship with TOTP, or just a hook for it?). Document the password reset flow end-to-end including rate limits and token expiry.
3. **Authorization model.** Roles (`applicator`, `manager`, future `org_admin`?), scopes, ownership rules (a contractor can only submit records they created; a manager can review any record in their org; what about cross-org auditors?). Express as a decision table, not prose.
4. **Resource map.** One row per Dexie table, mapped to one or more REST resources. Note any resources that are server-only (e.g., audit log access for managers, system-wide product catalog updates).
5. **Sync protocol.** This is the heart of the API. The client is offline-first; records are created locally with client-generated UUIDs and `syncStatus = "queued"`, then flushed when the network returns. Specify:
   - Idempotency key strategy (every mutating request carries one; server stores the result and replays it on retry).
   - Conflict resolution. The client's local record may be stale relative to the server's (e.g., a manager already requested correction). Define server-wins, client-wins, or merge per field and document why.
   - Batch sync endpoint? Or per-record? Or both? Justify.
   - Sync status transitions: who sets `syncing` (client) vs. `synced` / `sync_failed` (server reply)? Make it unambiguous.
   - How `recordEvents` reconcile — does the client send local events that the server replays, or does the server author its own events on receipt? (The current client appends events locally; pick a story and stick to it.)
6. **Lifecycle endpoints.** For each workflow transition (`draft → submitted`, `submitted → pending_review`, `pending_review → needs_correction`, `pending_review → locked`, `locked → exported`), specify: HTTP verb, path, request body, server-side checks (role, ownership, current status, invariants), events appended, and side effects (product snapshot creation, PDF generation job, etc.).
7. **Compliance check semantics.** The client runs `runAllComplianceChecks` and stores outcomes. Decide whether the server re-runs these on submit (recommended — the client cannot be trusted), and whether the stored outcomes are the server's or the client's. Document the rule-versioning story: if a rule changes after a record is submitted, the stored outcome is preserved verbatim.
8. **Pagination, filtering, sorting.** Cursor-based (recommended) or offset-based. Standardize across all list endpoints. Define the cursor format, default page size, max page size, and which fields are filterable/sortable per resource.
9. **File export.** Locked records can be exported as PDF (`applicationRecordPdf.ts` exists client-side). Server endpoint should: (a) accept an export request, (b) enqueue a background job, (c) return a job id + polling URL or signed download URL with TTL, (d) emit an `exported` event on completion. Do not stream the PDF synchronously.
10. **Error model.** Full table of error codes (`AUTH_REQUIRED`, `FORBIDDEN`, `RECORD_LOCKED`, `STATUS_TRANSITION_INVALID`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_FAILED`, `RATE_LIMITED`, `CONFLICT_STALE_RECORD`, etc.) mapped to HTTP status codes, when they fire, what the client should do, and what (if anything) gets logged.
11. **Observability.** Structured logging (JSON, with `requestId`, `userId`, `orgId`, `recordId` where applicable), metrics surface (RED method: rate / errors / duration per endpoint), audit log for security-sensitive actions (login, role change, lock, export). Specify retention.
12. **Deployment & secrets.** `.env.example` contents for the server. Where secrets live in prod (AWS Secrets Manager / Vault / GCP Secret Manager). Rotation policy.
13. **Open questions.** Any decision you couldn't make without a product call — list them explicitly so the next reviewer can answer.

### 3. `migrations/0001_initial_schema.sql` (and a `down` counterpart)

The first migration, expressed in raw Postgres 16 SQL — produced as the output of `drizzle-kit generate` against your Drizzle schema, then hand-audited and committed. Both the Drizzle schema file (`src/db/schema.ts` on the server) and the generated SQL go in the deliverable. Must include:

- All tables corresponding to the Dexie stores, with fixed-shape fields as real columns per constraint #14 (not buried in `jsonb`).
- Postgres enum types for `workflow_status`, `sync_status`, `rup_status`, `review_status`, `record_event_type`, `user_role` — derived from the Zod enums in `src/domain/schemas.ts`.
- All required indexes: mirror the Dexie index hints in `fieldlogDb.ts`, plus a B-tree on `(organization_id, workflow_status)` and `(organization_id, sync_status)` for the review-queue and sync-flush paths, plus a GIN index on `record_events.metadata` if you keep that as `jsonb`.
- `organization_id` on every row, with a foreign key and `NOT NULL`. Cross-tenant access prevention is enforced at the query layer (Drizzle middleware / repository pattern); document that.
- A trigger enforcing "no UPDATE or DELETE on `record_events`" — `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`.
- A trigger enforcing "no UPDATE on `application_records` once `workflow_status = 'locked'`" with an explicit allowlist for the `locked → exported` transition (only `workflow_status`, `system.lastUpdatedAt`, and an appended `exported` event are mutable on that hop).
- A CHECK constraint on `application_records` enforcing the lifecycle state machine (e.g., `workflow_status IN (...)` and any forbidden transitions caught at insert/update time).
- `created_at` / `updated_at` as `timestamptz` with `DEFAULT now()`.

The `down` migration must reverse the structure cleanly on a fresh database. It does not need to be safe to run against populated production data — document that, and document the Drizzle migration command (`drizzle-kit drop` semantics) the deploy pipeline uses.

### 4. `error_codes.md`

The full error-code table from section 10 of the architecture doc, extracted as a standalone reference for client and server implementers.

### 5. `client_migration_notes.md`

What the existing React/Dexie client has to change to talk to this API. Short, pragmatic, specifically:

- Where the existing service-layer functions in `src/application/*` need a network call added.
- Which Zod schemas need a server-shape variant (e.g., adding `serverId`, `etag`, `createdByUserId` fields).
- Sync flush function: where it lives, when it runs (online detect, manual trigger, periodic), how it handles partial failure.
- How the demo session/role context is replaced with real auth.

## Style Rules

- **Be concrete.** Every endpoint has a path. Every request body has a schema. Every error has a code. "TBD" is acceptable only inside the "Open questions" section.
- **Prefer tables to prose** for: role/permission matrices, error code lists, lifecycle transitions, rate-limit policies.
- **Cite the source of every rule** that comes from the existing codebase (e.g., "`workflowStatus` enum per `src/domain/schemas.ts:5-13`") so the next reviewer can verify you didn't drift.
- **No marketing language.** No "best-in-class," no "robust," no "seamless." This is a working document.
- **Flag every divergence** from the v0.1 client in a single, scannable section.
- **Do not invent product behavior.** If the v0.1 docs and code don't tell you what should happen, put it in "Open questions" — don't guess.

## When You're Done

Run the OpenAPI file through a linter (`spectral lint openapi.yaml` or equivalent) and paste the clean output at the top of `api_architecture.md`. Run any SQL through a parser to confirm it's syntactically valid. Then summarize, in under 300 words, the three biggest decisions you made and the three biggest open questions you couldn't answer without a product call. That summary is what a human reviewer reads first.
