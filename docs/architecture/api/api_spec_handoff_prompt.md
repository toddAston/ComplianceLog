# API Specification Handoff Prompt

Use this prompt to generate the complete server-side API specification for FieldLog. Hand it to a fresh agent (or a backend partner) along with read access to this repo. The output is a deliverable, not a conversation — the agent should produce concrete artifacts, not ask the user to make every decision.

---

## 1. Role

You are a senior backend architect picking up FieldLog after the offline-only v0.1 client has shipped. Your job is to design and document the complete HTTP API that the existing React/Dexie client will sync against, and that the future contractor mobile app and manager web app will both consume. This is a clean-slate server design — no legacy endpoints to preserve — but the client's domain model, lifecycle, and invariants are non-negotiable inputs.

## 2. Mission

FieldLog captures pesticide application records as **legally-defensible, immutable evidence** under Missouri 2 CSR 70-25.120 and equivalent state rules. The system is **not** a legal authorization engine; it captures what was done, by whom, when, where, and with what product, and freezes a Product Snapshot at submit time so the catalog cannot retroactively rewrite history. Chain of custody is the product. Treat every design choice through that lens — if a feature could let a record be silently altered after lock, it is wrong.

## 3. Required Reading (in this order)

These exist in the repo. Do not start designing until you have read them.

| # | Path | What it gives you |
|---|---|---|
| 1 | `CLAUDE.md` | Project rules, trust boundary, current scaffold state. |
| 2 | `docs/product/fieldlog_design_model_v0_1.json` | Canonical fields, controls, required rules, workflow/sync enums. |
| 3 | `docs/architecture/reproducible-design/fieldlog_reproducible_design_v0_1.md` | Full design snapshot. |
| 4 | `docs/architecture/diagrams/fieldlog_mermaid_diagrams_v0_1.mmd` | Golden-path flow, lifecycle state machine, ERD. |
| 5 | `docs/domain/examples/application_record_v01.json` | Example record instance. |
| 6 | `src/domain/schemas.ts` | **Authoritative** Zod schemas. Your OpenAPI schemas must be structurally compatible (field-for-field, enum-for-enum). |
| 7 | `src/domain/types.ts` | Derived TS types. Do not duplicate — reference the Zod source. |
| 8 | `src/db/fieldlogDb.ts` | Current Dexie tables and indexes. Mirror the resource set 1-to-1 unless you have a documented reason to deviate. |
| 9 | `src/application/*` | Service layer. Your API verbs must cover every public function exported here. |
| 10 | `FieldLog Development Blueprint.md` | Regulatory analysis and rationale. |

If anything in your spec diverges from these sources, list it in a single **"Divergences from v0.1 client"** section with the reason. Do not silently realign.

## 4. Hard Constraints

These are not negotiable. Echo this whole section back at the top of `api_architecture.md` to confirm receipt.

### 4.1 Security & Auth

1. **No hardcoded secrets.** Every secret comes from environment variables; every env var has a placeholder in a server-side `.env.example`.
2. **Auth on every endpoint.** Each endpoint declares (a) authentication required? (b) which roles? (c) which org scope? (d) which record-level ownership check? "Public" endpoints must be called out and justified.
3. **Auth endpoints are rate-limited.** Document the policy (per IP, per user, per token), the storage backend (Redis), and the 429 response shape.
4. **Passwords hashed with argon2id (preferred) or bcrypt.** Never plaintext, never reversible encryption, never SHA-family-only. Document work-factor / memory-cost parameters and the rotation plan.
5. **Error responses don't leak internals.** No stack traces, no raw SQL errors, no ORM internals. Define a uniform envelope (`{ error: { code, message, requestId } }`) and a mapping from internal exceptions to safe public codes.
6. **Tenant isolation.** Every row belongs to an `organizationId`. Every query filters by the caller's org. Cross-tenant access is an auth bug, not a feature.

### 4.2 Data Integrity & Validation

7. **Server-side validation on every endpoint.** Re-validate every payload against the existing Zod schemas (`src/domain/schemas.ts`) at the API boundary — these schemas are the source of truth and must be **imported** into the server, not re-typed. Trust nothing from the client.
8. **Postgres 16+ as the system of record.** Locked, not "unless justified otherwise."
9. **Drizzle ORM, no raw string SQL.** Chosen because (a) `drizzle-zod` lets the existing Zod schemas drive validation, preserving the "Zod is source of truth" rule from CLAUDE.md; (b) its schema is plain TypeScript so the migration tool and the runtime see the same types; (c) it stays close to SQL, which matters for the triggers and `jsonb` operators we need. When you need a query Drizzle can't express, use its `sql\`...\`` tagged template with bound parameters — never interpolation.
10. **Migrations are reversible.** Every migration has both `up` and `down`. Document the migration tool (`drizzle-kit`), the naming convention, and the deploy-time policy (no destructive `down` in prod without a manual override).
11. **Flatten known fields, `jsonb` only for open-ended bags.** Every field with a fixed shape in `src/domain/schemas.ts` becomes a real Postgres column with real types, constraints, and indexes — `workflow_status`, `sync_status`, `organization_id`, `application_date` (`date`), `epa_registration_number` (`text` + CHECK), `rup_status` (enum), `acres_treated` (`numeric`), `created_at` (`timestamptz`), etc. Reserve `jsonb` for genuinely open-ended payloads: `record_events.metadata`, `contractor_inputs.weather_snapshot` (third-party shape may evolve), future audit context. Never store an entire application record as one `jsonb` blob. Where a `jsonb` column has a stable shape internally, add a CHECK with `jsonb_typeof` or a Zod-validated insert path.

### 4.3 Lifecycle Invariants

12. **Immutability after `locked`.** Once `workflowStatus = locked`, the server rejects every mutation to `contractorInputs`, `managerInputs`, `productSnapshot`, and `system` — except appending a `recordEvents` row of type `exported`. Enforce at the **database** layer via trigger, not just in application code.
13. **Append-only audit log.** `recordEvents` rows are never UPDATEd or DELETEd by any user-facing endpoint. Enforce at the database layer. Document how administrative corrections (if any exist) are journaled.
14. **Product Snapshot is frozen at submit.** The snapshot row is written in the same transaction as `draft → submitted` and is never updated thereafter.

### 4.4 Runtime & Operations

15. **Long-running work goes in background jobs.** PDF export, sync reconciliation, email/SMS, large catalog imports — all run in BullMQ on Redis, never in the request handler. Document retry policy, dead-letter handling, and how the client polls (or subscribes via SSE) for completion.
16. **Containerized deployment is first-class.** The API ships as an OCI container image. The image must:
    - Run as a non-root user.
    - Have no secrets baked in — every secret is read from env at startup.
    - Log to stdout/stderr as JSON (no log files inside the container).
    - Expose `/healthz` (liveness) and `/readyz` (readiness — actually probes Postgres and Redis).
    - Handle `SIGTERM` for graceful shutdown: drain in-flight requests, close DB pool, close Redis pool.
    - Cold-start in under 5 seconds.
    - Be reproducible: pinned base-image digest, no `apt-get update` without a pinned package list, no `:latest` tags anywhere.

## 5. Deliverables

Produce **all** of the following under `docs/architecture/api/`. Filenames are suggestions; if you change one, update this list.

### 5.1 `openapi.yaml` — OpenAPI 3.1 specification

A single, lint-clean OpenAPI 3.1 file covering every endpoint.

- **Components/schemas** are derived from `src/domain/schemas.ts`. Use `$ref` aggressively — no inline duplication of record shapes. Where the server adds fields the client doesn't have (`serverId`, `etag`, `createdByUserId`), document why.
- **Every endpoint** has: summary, description, tags, parameters, request body schema, **all** response codes (400/401/403/404/409/422/429/500 where applicable), security requirements, rate-limit headers, idempotency-key header where applicable.
- **`security`** is declared globally; per-endpoint overrides only when the endpoint is intentionally unauthenticated. Default is authenticated.
- **Examples** are real, not placeholder — pull from `docs/domain/examples/application_record_v01.json` where possible.
- **No `additionalProperties: true` on request bodies.** Strict validation only.
- The file must pass `spectral lint openapi.yaml` (or equivalent) cleanly. Paste the clean output at the top of `api_architecture.md`.

### 5.2 `api_architecture.md` — architecture document

Sections, in order:

1. **Stack details.** Stack is fixed: **Node 22+ LTS / TypeScript / Fastify / Drizzle ORM / Postgres 16+ / BullMQ on Redis**, shipped as an OCI container. Your job is to (a) explain how Drizzle schemas are derived from or co-defined with the existing Zod schemas — recommend `drizzle-zod` or a hand-written mapping, pick one and justify; (b) describe the project layout (is `/src/domain` shared with the client? a private npm package? a monorepo?); (c) list production dependencies with pinned major versions; (d) name the hosting target. Any OCI-capable platform works (Fly.io, Railway, AWS ECS/Fargate, GCP Cloud Run, Kubernetes) — pick the simplest that gives you managed Postgres + managed Redis + horizontal scaling. Justify in one paragraph against operational burden, cold-start latency for the readiness probe, and the monthly cost of one small API instance + one DB + one Redis at v1 scale.
2. **Authentication & session model.** Cookie session vs. JWT vs. opaque bearer token. Refresh-token rotation, revocation list, multi-device behavior, "remember me" semantics, MFA roadmap (does v1 ship with TOTP, or just a hook for it?). Document the password reset flow end-to-end including rate limits and token expiry.
3. **Authorization model.** Roles (`applicator`, `manager`, future `org_admin`?), scopes, ownership rules (a contractor can only submit records they created; a manager can review any record in their org; what about cross-org auditors?). Express as a **decision table**, not prose.
4. **Resource map.** One row per Dexie table, mapped to one or more REST resources. Note any server-only resources (audit log access for managers, system-wide product catalog updates).
5. **Sync protocol.** The heart of the API. Client is offline-first; records are created locally with client-generated UUIDs and `syncStatus = "queued"`, flushed when the network returns. Specify:
   - Idempotency-key strategy (every mutating request carries one; server stores the result and replays it on retry).
   - Conflict resolution. The client's local record may be stale (e.g., a manager already requested correction). Define server-wins, client-wins, or merge per field — and why.
   - Batch sync endpoint, per-record, or both? Justify.
   - Sync-status transitions: who sets `syncing` (client) vs. `synced` / `sync_failed` (server reply)? Make it unambiguous.
   - How `recordEvents` reconcile — does the client send local events that the server replays, or does the server author its own events on receipt? Pick a story and stick to it.
6. **Lifecycle endpoints.** For each transition (`draft → submitted`, `submitted → pending_review`, `pending_review → needs_correction`, `pending_review → locked`, `locked → exported`): HTTP verb, path, request body, server-side checks (role, ownership, current status, invariants), events appended, side effects (snapshot creation, PDF job enqueue, etc.). **Use a table.**
7. **Compliance check semantics.** The client runs `runAllComplianceChecks` and stores outcomes. Decide whether the server re-runs on submit (recommended — the client cannot be trusted) and whether the stored outcomes are the server's or the client's. Document the rule-versioning story: if a rule changes after a record is submitted, the stored outcome is preserved verbatim.
8. **Pagination, filtering, sorting.** Cursor-based (recommended) or offset-based. Standardize across all list endpoints. Define cursor format, default page size, max page size, and which fields are filterable/sortable per resource.
9. **File export.** Locked records can be exported as PDF (`applicationRecordPdf.ts` exists client-side). Server endpoint: (a) accepts an export request, (b) enqueues a background job, (c) returns a job id + polling URL or signed download URL with TTL, (d) emits an `exported` event on completion. **Do not stream the PDF synchronously.**
10. **Error model.** Full table of error codes (`AUTH_REQUIRED`, `FORBIDDEN`, `RECORD_LOCKED`, `STATUS_TRANSITION_INVALID`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_FAILED`, `RATE_LIMITED`, `CONFLICT_STALE_RECORD`, etc.) mapped to HTTP status codes, fire conditions, client recovery action, and what gets logged.
11. **Observability.** Structured logging (JSON, with `requestId`, `userId`, `orgId`, `recordId` where applicable), metrics surface (RED method: rate / errors / duration per endpoint), audit log for security-sensitive actions (login, role change, lock, export). Specify retention.
12. **Deployment & secrets.** Server-side `.env.example` contents. Where secrets live in prod (AWS Secrets Manager / Vault / GCP Secret Manager / platform-native — consistent with the hosting target). Rotation policy. How the container picks up rotated secrets (restart, sidecar reload).
13. **Containerization & runtime.** Cover, in order:
    1. Multi-stage `Dockerfile` strategy — `deps` stage produces a pruned `node_modules`; `build` stage emits `dist/`; `runtime` stage uses `gcr.io/distroless/nodejs22-debian12` pinned by digest, runs as `nonroot`. Justify the base image choice.
    2. How migrations run on deploy — a **separate one-shot container** running `drizzle-kit migrate` before the API container starts is the recommended pattern, not the API's startup hook. Justify if you deviate.
    3. `/healthz` and `/readyz` contract — what each probes, response codes, orchestrator timeouts.
    4. `SIGTERM` graceful-shutdown behavior — request-drain timeout, DB pool close, Redis close, in-flight BullMQ worker behavior.
    5. Image tag & registry strategy — semver + git SHA tags, no `:latest` in production manifests, which registry.
    6. Image-scan + SBOM expectations — Trivy (default) / Grype / Snyk in CI, failing the build on `HIGH` or `CRITICAL` CVEs in dependencies or base image.
14. **Open questions.** Decisions you couldn't make without a product call — list explicitly so the next reviewer can answer.

### 5.3 `migrations/0001_initial_schema.sql` (+ `down` counterpart)

Raw Postgres 16 SQL, produced as the output of `drizzle-kit generate` against your Drizzle schema, then hand-audited. Commit both the Drizzle schema file (`src/db/schema.ts` on the server) and the generated SQL.

- All tables corresponding to the Dexie stores, with fixed-shape fields as real columns per constraint #11 (not buried in `jsonb`).
- Postgres enum types for `workflow_status`, `sync_status`, `rup_status`, `review_status`, `record_event_type`, `user_role` — derived from the Zod enums in `src/domain/schemas.ts`.
- All required indexes: mirror the Dexie hints in `fieldlogDb.ts`, plus B-tree on `(organization_id, workflow_status)` and `(organization_id, sync_status)` for the review-queue and sync-flush paths, plus a GIN index on `record_events.metadata` if you keep it as `jsonb`.
- `organization_id` on every row, FK + `NOT NULL`. Cross-tenant access prevention is enforced at the query layer (Drizzle middleware / repository pattern) — document that.
- Trigger enforcing "no UPDATE or DELETE on `record_events`" — `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`.
- Trigger enforcing "no UPDATE on `application_records` once `workflow_status = 'locked'`" with an explicit allowlist for the `locked → exported` transition (only `workflow_status`, `system.lastUpdatedAt`, and an appended `exported` event are mutable on that hop).
- CHECK constraint on `application_records` enforcing the lifecycle state machine (forbidden transitions caught at insert/update time).
- `created_at` / `updated_at` as `timestamptz` with `DEFAULT now()`.

The `down` migration must reverse the structure cleanly on a fresh database. It does **not** need to be safe against populated production data — document that, and document the `drizzle-kit` semantics the deploy pipeline uses.

### 5.4 `error_codes.md`

The error-code table from section 10 of the architecture doc, extracted as a standalone reference for client and server implementers.

### 5.5 `client_migration_notes.md`

What the existing React/Dexie client has to change to talk to this API. Short, pragmatic:

- Where the existing service-layer functions in `src/application/*` need a network call added.
- Which Zod schemas need a server-shape variant (e.g., adding `serverId`, `etag`, `createdByUserId`).
- Sync flush function — where it lives, when it runs (online detect, manual trigger, periodic), how it handles partial failure.
- How the demo `SessionContext` / `DEMO_*_ACTOR` constants are replaced with real auth.

### 5.6 Container artifacts — `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `docker/README.md`, CI workflow

Working files, not pseudocode.

- **`Dockerfile`** — three stages:
  - `deps`: `node:22-bookworm-slim` pinned by digest; `npm ci --omit=dev`.
  - `build`: same base; installs full deps; runs `tsc` (or your build tool) to emit `dist/`.
  - `runtime`: `gcr.io/distroless/nodejs22-debian12` pinned by digest; copies `node_modules` from `deps` and `dist/` from `build`; `USER nonroot`; `EXPOSE 8080`; `ENTRYPOINT ["node", "dist/server.js"]`.
  - No `apt-get`, no shell in the final image, no build tools in the final image.
  - `HEALTHCHECK` calling `/healthz` if the orchestrator uses Docker-level health checks; otherwise document that Kubernetes/Cloud Run probes replace it.
- **`docker-compose.yml`** — local dev only, never used in production:
  - `api` built from the local `Dockerfile`, with source mounted only via a dev-mode override file so the production image stays clean.
  - `postgres:16` with a named volume, healthcheck, `POSTGRES_PASSWORD` from `.env` (never hardcoded).
  - `redis:7-alpine` with a healthcheck.
  - `migrate` one-shot service that depends on `postgres` healthy, runs `drizzle-kit migrate`, then exits.
  - `api` depends on `migrate` completing and `redis` healthy.
  - Default compose network; no published ports for Postgres/Redis except via opt-in override.
- **`.dockerignore`** — at minimum: `node_modules`, `.git`, `dist`, `coverage`, `.env*` (never bake env files into the image), `*.md` except `package.json`, `reference/vendor-docs/`, `docs/`, `research/`, `data/`.
- **`docker/README.md`** — one paragraph each for "how to run locally" and "how the production image differs from compose," plus the full list of environment variables the container reads at startup (referencing the server `.env.example` as the canonical list).
- **CI workflow** (GitHub Actions YAML by default — substitute the team's runner if different) that on every push to `main`:
  1. Builds the image.
  2. Runs Trivy against it.
  3. **Fails the build on any `HIGH` or `CRITICAL` CVE** in dependencies or base image.
  4. Tags the image with both the git SHA and the semver from `package.json`.
  5. Pushes only if scan passed.

## 6. Style Rules

- **Be concrete.** Every endpoint has a path. Every request body has a schema. Every error has a code. "TBD" is acceptable only inside "Open questions."
- **Prefer tables to prose** for: role/permission matrices, error codes, lifecycle transitions, rate-limit policies, resource maps.
- **Cite the source of every rule** that comes from the existing codebase (e.g., "`workflowStatus` enum per `src/domain/schemas.ts:5-13`") so the next reviewer can verify you didn't drift.
- **No marketing language.** No "best-in-class," no "robust," no "seamless." This is a working document.
- **Flag every divergence** from the v0.1 client in a single, scannable section.
- **Do not invent product behavior.** If the v0.1 docs and code don't tell you what should happen, it goes in "Open questions" — never guess.

## 7. When You're Done

1. Run `spectral lint openapi.yaml` (or equivalent). Paste the clean output at the top of `api_architecture.md`.
2. Run the SQL through a Postgres parser (`pg_query`, `psql -f --dry-run`-equivalent, or just `psql` against a throwaway DB) to confirm it's syntactically valid.
3. Build the container locally — `docker compose build` and `docker compose up` must succeed end-to-end on a fresh checkout with only `.env.example` copied to `.env`.
4. Write a **< 300-word executive summary** at the top of `api_architecture.md`: the three biggest decisions you made and the three biggest open questions you couldn't answer without a product call. That summary is what a human reviewer reads first.
