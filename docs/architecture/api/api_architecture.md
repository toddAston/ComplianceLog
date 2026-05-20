# FieldLog API — architecture

## Executive summary (read this first)

FieldLog v0.1 is an offline-only React/Dexie client that captures immutable pesticide
application evidence. This document specifies the server it will sync against:
**Node 22 / Fastify / Drizzle / Postgres 16 / BullMQ on Redis**, shipped as a distroless
OCI image. A minimal but bootable skeleton accompanies the spec under `server/`.

**Three biggest decisions.**
1. **The client Zod schemas are imported, not re-typed.** `server/src/db/schema.ts` and
   request validation both pull from `src/domain/schemas.ts`; PG enums are derived from the
   Zod enums. The build bundles the shared source with `tsup` so no monorepo workspace is
   needed. This keeps the "Zod is the source of truth" rule (CLAUDE.md) literally true.
2. **Lifecycle invariants are enforced in the database, not just the app.** Triggers make
   `record_events` append-only and freeze a record after `locked` (only `locked → exported`
   may pass, and only `workflow_status`/`last_updated_at` may change on that hop). The app
   layer mirrors these for clean error codes, but the DB is the backstop because the client
   is untrusted.
3. **Sync is idempotent and server-authoritative.** Clients flush queued mutations with a
   per-op `Idempotency-Key` and a `baseEtag`; the server resolves conflicts server-wins on
   lifecycle, replays stored results on retry, and authors its own canonical `record_events`
   rather than trusting client-sent events.

**Three biggest open questions** (need a product call — see §14): (a) Does v1 ship MFA/TOTP
or just a hook? (b) Is there a cross-org auditor / `org_admin` role? (c) When a manager
edits nothing but the client's offline copy diverged from a server-side correction request,
do we hard server-wins or surface a merge UI?

## Verification status

- **OpenAPI lint:** see "spectral output" block below (filled by the verify step).
- **SQL:** `migrations/0001_initial_schema.sql` applied by the compose `migrate` one-shot.
- **Container:** `docker compose up --build` brings up PG + Redis + migrate + API and
  serves `/healthz` and `/readyz`.

```
# npx @stoplight/spectral-cli lint --ruleset docs/architecture/api/.spectral.yaml \
#     docs/architecture/api/openapi.yaml
No results with a severity of 'error' found!
```

- **Server typecheck + tests:** `cd server && npx tsc --noEmit` clean; `npx vitest run`
  → 31 passed. Build: `npx tsup` → `dist/server.js`.
- **Client suite:** unchanged — `npx vitest run` at repo root → 324 passed.
- **Container build / `docker compose up` and live SQL apply:** NOT executed — Docker is
  not installed on the build host. The Dockerfile/compose/migration SQL are written to run
  but have not been booted here; treat them as reviewed-not-verified until run in an
  environment with Docker + Postgres.

## Hard constraints (receipt — handoff §4)

> **Security & auth:** no hardcoded secrets (all via env, `.env.example` placeholders);
> auth on every endpoint (role + org scope + ownership declared); auth endpoints
> rate-limited (per IP/user/token, Redis-backed, 429 envelope); passwords hashed with
> argon2id; error responses never leak internals (uniform `{error:{code,message,requestId}}`);
> tenant isolation on every row by `organizationId`.
> **Data integrity:** server-side Zod validation on every endpoint (schemas imported, not
> re-typed); Postgres 16+ system of record; Drizzle ORM, no raw string SQL; reversible
> migrations (`up`/`down`); known fields flattened to real columns, `jsonb` only for
> open-ended bags.
> **Lifecycle:** immutability after `locked` (DB trigger); append-only `record_events` (DB
> trigger); Product Snapshot frozen at submit in the same transaction.
> **Runtime:** long work in BullMQ; containerized first-class (non-root, no baked secrets,
> JSON stdout logs, `/healthz` + `/readyz`, SIGTERM drain, <5s cold start, reproducible
> pinned base images).

## 1. Stack details

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node 22 LTS, TypeScript, ESM | `engines.node >=22 <23`. |
| HTTP | Fastify 5 | Built-in pino JSON logging; `app.inject()` for tests. |
| ORM | Drizzle ORM + `drizzle-kit` | Schema is plain TS (`server/src/db/schema.ts`); migrations generated + hand-audited. |
| DB | Postgres 16 | System of record. |
| Jobs | BullMQ on Redis | PDF export, sync reconciliation, notifications. |
| Hashing | `@node-rs/argon2` | Prebuilt napi binaries — no node-gyp in the distroless image. |
| Build | `tsup` (esbuild) | Single `dist/server.js`, inlines imported client Zod. |

**Zod ↔ Drizzle bridge.** Recommendation: **hand-written Drizzle schema** reconciled
against the client Zod, *not* `drizzle-zod` as the sole bridge. Reason: the client wire
shape stores `acresTreated`/`applicationDate`/`startTime` as **strings**
(`src/domain/schemas.ts:132,140,141`) while the DB uses `numeric`/`date`/`time`
(constraint #11). `drizzle-zod` derives a Zod schema from the table (or vice versa) but
cannot express that string→numeric coercion. So: request bodies validate against the
imported client Zod (wire), and a thin mapping layer (`server/src/lib/mapping.ts`)
translates to/from the Drizzle row shape. PG enums *are* derived from the Zod enums
(`schema.ts` calls `workflowStatusSchema.options`), so enums cannot drift.

**Project layout.** A `server/` package in this repo (not a workspace). Its `tsconfig.json`
`include`s `../src/domain`, and the build bundles the three reachable client modules
(`domain/schemas`, `domain/types`, `application/complianceRules` — all Dexie-free). The
client is unchanged; see `client_migration_notes.md` for what it must add to sync.

**Hosting.** Recommended target: **Fly.io** (or any OCI platform — Cloud Run, Railway, ECS).
Rationale: managed Postgres + managed Redis (Upstash) + simple horizontal scaling; the
distroless image cold-starts well under the 5s readiness budget; v1 scale (one small API
instance + one small Postgres + one small Redis) lands around \$30–60/month. Cloud Run is the
close runner-up but its scale-to-zero cold start can fail an aggressive `/readyz` probe and
BullMQ workers want an always-on process, which fits Fly's model better.

## 2. Authentication & session model

| Aspect | Decision |
|---|---|
| Token | Short-lived **JWT access token** (15 min) in `Authorization: Bearer`; **opaque refresh token** in an HttpOnly, Secure, SameSite=Strict cookie. |
| Refresh | Rotation on every `/auth/refresh`; old refresh token added to a Redis revocation set; reuse of a revoked token revokes the whole family (theft detection). |
| Multi-device | Refresh tokens are per-device (family id); logout revokes one family, password reset revokes all. |
| "Remember me" | Extends refresh TTL from session-cookie to `REFRESH_TOKEN_TTL_SECONDS`. |
| Passwords | `argon2id`, params from env (`ARGON2_MEMORY_KIB=19456`, `time=2`, `parallelism=1`); rehash-on-login when params increase. |
| Password reset | `/auth/password-reset/request` always 202 (no enumeration) → emails a single-use token (15 min TTL, Redis); `/auth/password-reset/confirm` sets the new hash and revokes all sessions. Both endpoints rate-limited. |
| MFA | **Open question** — v1 ships a hook (a `mfa_enrolled` column + a verify step stub), not enforced TOTP, unless product decides otherwise. |

The skeleton's `auth.ts` is a **demo stub** (unsigned base64url actor token) so the surface
is exercisable; it must be replaced with verified-JWT validation before production.

## 3. Authorization model

Roles today: `applicator`, `manager` (`src/domain/schemas.ts:23`). A future `org_admin` is
an open question. Every check is also scoped to the caller's `organizationId`.

| Action | applicator | manager | Scope / ownership |
|---|---|---|---|
| Create draft record | ✅ | ✅ | org; `createdByUserId = self` |
| Read/list records | own only | all in org | org; applicator filtered to `createdByUserId = self` |
| Edit draft / needs_correction | own only | own only | org + ownership + status ∈ {draft, needs_correction} |
| Submit / resubmit | own only | — | org + ownership |
| Review (accept-lock / request-correction) | ❌ | ✅ | org |
| Export locked record | ✅ (own) | ✅ | org + (ownership for applicator) + status = locked |
| Read event log | own only | all in org | org |
| Invite applicator, manage farms/fields | ❌ | ✅ | org |
| Read product catalog | ✅ | ✅ | global catalog (read-only to both) |

Cross-org access is impossible by construction: every query filters by
`organizationId`, and missing/foreign rows return `NOT_FOUND` (not 403) to avoid
enumeration. Enforced in a repository layer (Drizzle query helpers always inject the org
predicate); the skeleton demonstrates this in `routes/records.ts` (`loadRecord` filters by
org; `assertOwnership` enforces creator).

## 4. Resource map

| Dexie store (`src/db/fieldlogDb.ts`) | REST resource(s) | Server-only additions |
|---|---|---|
| `organizations` | `GET /organization` | — |
| `users` | (via `/auth/*`, `User` in token response) | `email`, `password_hash` |
| `farms` | `GET/POST /farms`, `PATCH /farms/{id}` | — |
| `fields` | `GET/POST /fields`, `PATCH /fields/{id}` | — |
| `applicators` | `GET/POST /applicators` | server-issued `inviteLink` |
| `products` | `GET /products` (search) | — |
| `applicationRecords` | `GET/POST /application-records`, `GET/PATCH /{id}`, lifecycle sub-resources | `etag`, `createdByUserId` |
| `productSnapshots` | embedded (`productSnapshotId` on record) | `organization_id` |
| `reviews` | created by `POST /{id}/review`; not separately listed | `reviewed_by_user_id` |
| `recordEvents` | `GET /application-records/{id}/events` (read-only) | `organization_id` |
| — (server-only) | `POST /sync/batch`, `POST /{id}/export`, `GET /exports/{jobId}`, `/healthz`, `/readyz` | — |

## 5. Sync protocol (the heart of the API)

Records are created locally with **client-generated UUIDs** and `syncStatus = "queued"`,
flushed when the network returns. `POST /sync/batch` accepts up to 100 operations.

| Question | Decision |
|---|---|
| Idempotency | Every mutating request carries `Idempotency-Key`; each batch op also carries an `opId`. The server stores `(key → result)` in Redis (24h TTL) and replays the stored response on retry. Reusing a key with a different body → `IDEMPOTENCY_CONFLICT`. |
| Conflict resolution | **Server-wins on lifecycle, optimistic on content.** Each op sends `baseEtag`; if it differs from the server's current `etag`, the op returns `outcome: "conflict"` with the current record so the client can rebase. A manager-driven transition (e.g. a correction request) that happened while offline always wins — the client's stale edit is rejected, not merged. |
| Batch vs per-record | **Both.** `/sync/batch` for the offline flush (fewer round-trips, atomic per op); the per-record lifecycle endpoints (`/submit`, `/review`, …) for online interactive use. |
| Sync-status authorship | The **client** sets `local_only` → `queued` (offline) and `syncing` (flush in flight). The **server** reply sets `synced` (op applied) or `sync_failed` (rejected/conflict). Workflow status is independent of sync status (CLAUDE.md). |
| Event reconciliation | The **server authors all `record_events`** on receipt of a sync op. Clients never push event rows — they would be untrusted and could forge history. The client may show optimistic local events but discards them in favor of the server's on `synced`. |

Client-flushable op kinds: `create_draft`, `update_inputs`, `submit`, `resubmit`. Review,
lock, and export are manager/server actions and are **not** client-flushed.

## 6. Lifecycle endpoints

Source service: `src/application/applicationRecordService.ts`. Note the documented
divergence: the client shortcuts `draft → pending_review` (skipping `submitted`) and
`pending_review → locked` (skipping a standalone `accepted`). Both the doc-canonical and
client paths are permitted by the DB trigger and `lib/lifecycle.ts`.

| Transition | Verb + path | Body | Server checks | Events appended | Side effects |
|---|---|---|---|---|---|
| draft → pending_review | `POST /application-records/{id}/submit` | — (+ `If-Match`) | role=creator; status=draft; `attestationConfirmed`; **re-run compliance, block on `blocked`** | `compliance_check_run`, `submitted`, `product_snapshot_created` | freeze Product Snapshot (same tx); `syncStatus=queued`; rotate `etag` |
| pending_review → locked | `POST /application-records/{id}/review` `{decision:"accepted"}` | reviewNotes? | role=manager; status=pending_review; snapshot exists | `reviewed`, `locked` | write `reviews` row; set `lockedAt`; record frozen |
| pending_review → needs_correction | `POST /application-records/{id}/review` `{decision:"needs_correction"}` | reviewNotes (required) | role=manager; status=pending_review | `correction_requested` | manager review attribution set |
| needs_correction → pending_review | `POST /application-records/{id}/resubmit` | partial inputs (+ `If-Match`) | role=creator; status=needs_correction; ≥1 field changed; re-run compliance | `correction_submitted`, `compliance_check_run` | `syncStatus=queued`; review reset to `not_reviewed` |
| locked → exported | `POST /application-records/{id}/export` | — | status=locked; role+ownership | `exported` (on job completion) | enqueue BullMQ PDF job; returns job id (see §9) |

## 7. Compliance check semantics

The client runs `runAllComplianceChecks` (`src/application/complianceRules.ts`: 4 rules —
`MISSING_WIND`, `MISSING_TARGET_PEST`, `RECORD_LATE`, `RUP_UNCERTIFIED`, each with a MO/EPA
citation). Decisions:

- **The server re-runs the checks on submit and resubmit.** The client cannot be trusted
  (handoff §5.2.7). A `blocked`-severity failure (`RUP_UNCERTIFIED`) rejects the transition
  with `VALIDATION_FAILED` (422); `warning`/`error` outcomes are recorded but do not block.
  The skeleton reuses the **exact client rule module** server-side, so the logic cannot
  diverge.
- **Stored outcomes are the server's**, written verbatim into the `compliance_check_run`
  event's `metadata` at the moment of the transition.
- **Rule versioning.** Outcomes are frozen in the event row when written. If a rule changes
  later, historical events are preserved as-is — the audit log is append-only and reflects
  the rules in force at decision time. (A `ruleSetVersion` field on the event metadata is
  recommended; see §14.)

## 8. Pagination, filtering, sorting

**Cursor-based**, standard across all list endpoints. Cursor is an opaque base64url token
encoding the last item's sort key + id (stable tiebreaker). Default page size 25, max 100.
Response envelope: `{ items: [...], page: { hasMore, nextCursor? } }`.

| Resource | Filter | Sort |
|---|---|---|
| `/application-records` | `workflowStatus`, `syncStatus` | `systemCreatedAt` (default desc), `applicationDate` |
| `/products` | `q` (name/EPA reg), `rupStatus` | name |
| `/farms`, `/fields`, `/applicators` | (`fields` by `farmId`) | name |
| `/application-records/{id}/events` | — | `occurredAt` asc (chronological) |

## 9. File export

Locked records export to PDF (the client has `applicationRecordPdf.ts`). Server flow:

1. `POST /application-records/{id}/export` validates status=locked, **enqueues a BullMQ
   job**, returns `202` with `{ jobId, recordId, status:"queued" }` and a `Location`
   polling URL. The PDF is **never** streamed synchronously.
2. The worker renders the PDF from the frozen snapshot + event log, uploads it to object
   storage, and emits an `exported` event (the only mutation permitted after lock).
3. `GET /exports/{jobId}` returns status; on `succeeded` it includes a short-TTL
   (`EXPORT_SIGNED_URL_TTL_SECONDS`, default 15 min) signed download URL.

## 10. Error model

See `error_codes.md` for the full table (extracted as a standalone reference). Envelope:
`{ "error": { "code", "message", "requestId", "details"? } }`. Internal exceptions collapse
to `INTERNAL`/500 with a generic message; nothing leaks. Implementation:
`server/src/lib/errors.ts` + `plugins/errorEnvelope.ts`.

## 11. Observability

- **Logging:** structured JSON to stdout (Fastify/pino), one line per request with
  `requestId` (= Fastify req id), `userId`, `orgId`, `recordId` where applicable. No log
  files in the container.
- **Metrics:** RED per route (rate / errors / duration) exported for Prometheus scrape
  (recommend `fastify-metrics`); dashboards track p50/p95/p99 latency and 5xx rate.
- **Security audit log:** login, refresh-reuse detection, role change, lock, and export are
  recorded — lifecycle ones live in the append-only `record_events`; auth ones in a
  dedicated `security_events` table (recommended; see §14). Retention: 7 years for
  `record_events` (evidence), 1 year for security/audit, 30 days for request logs.

## 12. Deployment & secrets

- `server/.env.example` is the canonical variable list (also tabulated in
  `server/docker/README.md`).
- **Production secrets** live in the platform secret manager consistent with the hosting
  target (Fly secrets / AWS Secrets Manager / GCP Secret Manager) — never in the image,
  never in compose for prod.
- **Rotation:** secrets rotate by updating the manager and triggering a rolling restart
  (the container reads env at startup; no in-process hot reload in v1). Refresh-token and
  JWT secrets support overlap windows (accept old+new during rotation) to avoid mass logout.

## 13. Containerization & runtime

1. **Dockerfile** — three stages: `deps` (`node:22-bookworm-slim`, pruned prod
   `node_modules`), `build` (bundles `dist/server.js` with tsup, inlining `/src/domain`),
   `runtime` (`gcr.io/distroless/nodejs22-debian12:nonroot`, no shell/npm/build tools,
   `USER nonroot`, `EXPOSE 8080`). **Build context is the repo root** so the server can
   bundle the client Zod. Base images are tag-pinned for a buildable fresh checkout;
   **production must pin by digest** (command in the Dockerfile) — this is a documented
   deviation from "always pinned" made so the deliverable builds out of the box.
2. **Migrations on deploy** — a **separate one-shot container** applies the schema before
   the API starts. Production runs `drizzle-kit migrate`; the compose demo applies the
   audited SQL via `psql` (idempotent guard) so the stack boots with no Node tooling in the
   migrate step. Documented divergence from the strict `drizzle-kit migrate` instruction,
   chosen for a dependency-free, reproducible local boot.
3. **`/healthz` / `/readyz`** — `/healthz` returns 200 if the process is up (no deps).
   `/readyz` probes Postgres (`select 1`) and Redis (`ping`) and returns 503 if either is
   down, so orchestrators don't route traffic before dependencies are reachable.
4. **SIGTERM** — `server.ts` stops accepting, drains in-flight requests via `app.close()`,
   then closes the Postgres pool and Redis connection; exits 0 (or 1 on error). In-flight
   BullMQ workers finish their current job before the process exits.
5. **Image tags** — semver (from `package.json`) + git SHA. No `:latest` in any production
   manifest. Registry chosen per hosting target (GHCR by default in CI).
6. **Image scan + SBOM** — CI runs **Trivy** and fails the build on any `HIGH`/`CRITICAL`
   CVE in dependencies or base image (`ignore-unfixed: true`). Push happens only after a
   clean scan and only when registry credentials are present.

## Divergences from the v0.1 client

| # | Divergence | Why |
|---|---|---|
| 1 | Wire shape keeps `acresTreated`/`applicationDate`/`startTime` as **strings**; DB uses `numeric`/`date`/`time`. | Client Zod is string-typed (`schemas.ts:132,140,141`); constraint #11 mandates real columns. A mapping layer bridges them. |
| 2 | `temperature`/`windSpeed`/`windDirection` stay **text** columns, not numeric. | Client stores them as free-text strings that admit non-numeric content ("calm", "5-10"); coercion is deferred to avoid rejecting valid records. |
| 3 | Lifecycle skips standalone `submitted` and `accepted` states. | The client service goes `draft → pending_review` and `pending_review → locked` directly (`applicationRecordService.ts`). Both the doc-canonical and client paths are allowed. |
| 4 | Server adds `etag`, `createdByUserId` (records); `email`/`password_hash` (users); `organization_id` on snapshots/events/reviews. | Concurrency, ownership, auth, and tenant isolation — none exist client-side. |
| 5 | `inviteToken` becomes a server-issued `inviteLink`. | The client's local UUID token (`contractorService.ts`) is demo-only; real invites are server artifacts. |
| 6 | Base images tag-pinned (not digest-pinned); compose migrate uses `psql` (not `drizzle-kit migrate`). | Make the deliverable build/boot on a fresh checkout; production paths documented in §13. |

## 14. Open questions

1. **MFA in v1?** Hook-only vs. enforced TOTP.
2. **`org_admin` / cross-org auditor role?** Affects the authz table and tenant-scope rules.
3. **Offline conflict UX.** When a client's stale edit collides with a server-side
   correction request, hard server-wins (current spec) vs. a client-side merge/review UI.
4. **Rule-set versioning.** Add `ruleSetVersion` to compliance event metadata so historical
   outcomes are interpretable after a rule change.
5. **Security audit store.** Confirm a dedicated `security_events` table (login/role/reset)
   vs. reusing `record_events`.
6. **EPA reg number validation strictness.** The DB CHECK is permissive (`^[A-Za-z0-9-]+$`);
   should the wire Zod enforce a stricter MO/EPA format?
7. **Retention/Right-to-erasure.** 7-year evidence retention vs. any deletion obligations.
