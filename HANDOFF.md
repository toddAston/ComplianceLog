# FieldLog — Development Handoff

_Last updated: 2026-05-20. Read `CLAUDE.md` first for project rules; this doc is the "where we are / where we're going" layer on top of it._

## TL;DR

FieldLog is an **offline-first, evidence-grade** pesticide application recordkeeping PWA (Vite + React + TS + Dexie/IndexedDB, MUI, Zod). Two tracks are in flight:

1. **Backend API design + bootable server skeleton** — ✅ committed & pushed (`301af2a`).
2. **Client offline-first composite sync stack** — 🚧 **Phase 1 complete but UNCOMMITTED** in the working tree. Phases 2–3 not started.

**⚠️ First thing to know:** there is a large body of finished, verified, but **uncommitted** work in the working tree (the Phase 1 sync layer). Don't `git reset`/`stash`/`checkout` blindly. See "Git state" below.

---

## Git state (as of this handoff)

- Branch `main`, in sync with `origin/main`. Last commit `301af2a` = "Add server-side API spec and bootable Fastify/Drizzle skeleton" (pushed).
- **Uncommitted Phase 1 changes** (verified green, just not committed):
  - Modified: `src/App.tsx`, `src/application/applicationRecordService.ts`, `src/db/fieldlogDb.ts`, `src/domain/schemas.ts`, `src/domain/types.ts`, `src/ui/application-record/RecordDetailDialog.tsx`, `src/ui/system/OfflineBadge.tsx`, `src/ui/application-record/RecordDetailDialog.test.tsx` (one pre-existing malformed-assertion fix).
  - Deleted: `src/ui/system/SimulateSyncButton.tsx` + its test (replaced by `SyncControls`).
  - New: `src/application/sync/` (the whole sync layer), `src/db/migration.test.ts`, `src/ui/system/{ConflictBanner,SyncControls,SyncControls.test,useOnlineStatus}.tsx/ts`.
- **Next obvious step:** commit Phase 1. Remember the repo rule — **never `git add -A`** (it sweeps in research PDFs/zips). Enumerate paths. Suggested message: `Add offline-first sync spine (outbox, transport, flush, conflict UI)`.

---

## Track 1 — Backend API (committed)

Design deliverables + a minimal **bootable** Fastify/Drizzle/Postgres/Redis server skeleton, all under:
- `docs/architecture/api/` — `openapi.yaml` (lints clean), `api_architecture.md`, `error_codes.md`, `client_migration_notes.md`.
- `server/` — Drizzle schema (PG enums derived from client Zod), `migrations/0001_*.sql` (append-only + locked-immutability triggers), health/create/submit routes, error envelope, auth stub, vitest suite (31 passing), distroless Dockerfile + compose + CI.

Status: **not deployed.** It exists so the client sync layer has a real contract to target. `cd server && npx vitest run` works; `docker compose up` is written but Docker isn't installed on this machine (untested here).

---

## Track 2 — Offline-first composite sync stack (the active work)

**Why:** A contractor in a field with no signal must capture a legally-complete record against the MO 3-day deadline, and chain of custody must survive the network boundary. The plan implements 9 layered capabilities (CRDT/auto-merge explicitly **rejected** — silent merges break auditability). Delivered in 3 phases.

**Architecture decisions (locked):**
- **Transport interface + fake loopback.** All sync goes through `SyncTransport` (`src/application/sync/transport.ts`). Two impls: `loopbackTransport.ts` (in-memory, models ETag/idempotency/conflict/lifecycle — used for tests + offline demo) and `httpTransport.ts` (real server, wired but unverified until `server/` deploys). `defaultTransport.ts` picks loopback unless `VITE_API_URL` is set.
- **Sync intent, not state.** An outbox of operations (`create_draft`/`update_inputs`/`submit`/`resubmit`) mirroring the OpenAPI `SyncOperation`.
- **Server-authoritative + optimistic ETag.** Each record has an `etag`; ops send `baseEtag`. Mismatch → `conflict` → record `sync_failed` with the server copy stashed in `serverShadow` for rebase. Lifecycle is server-wins.
- **Dexie is SoR until `synced`, then a cache.** Capture/submit never block on network; only the *flush* is gated on connectivity.

### Phase 1 — Sync spine ✅ DONE (uncommitted)

What's built (all in `src/application/sync/` unless noted):
- `transport.ts` / `loopbackTransport.ts` / `httpTransport.ts` / `defaultTransport.ts` — the seam.
- `outbox.ts` — `buildOutboxOp`, `getPendingOperations`, mark/remove helpers.
- `syncService.ts` — `flushOutbox` (single-flight; applies applied/conflict/rejected; reverts batch on transport throw), plus `adoptServerCopy` and `retryRecordSync` for conflict resolution.
- `useSyncFlush.ts` — single app-wide flush controller (triggers: online event, foreground/visibilitychange, 30s interval, manual). Note: a **silent `autoFlush`** (no setState) is used by effects, and a **stateful `flush`** by the manual button — this split is deliberate to satisfy the React-hooks lint rules; keep it.
- `src/db/fieldlogDb.ts` — Dexie **`version(2)`** (additive: `outbox` + `catalogMeta` stores). Record sync fields (`etag`/`syncError`/`lastSyncedAt`/`serverShadow`) are non-indexed, so they needed no schema change.
- `src/domain/schemas.ts` + `types.ts` — `outboxOperationSchema`, `catalogMetaSchema`, `syncOperationKindSchema`; record schema extended with optional sync fields.
- `src/application/applicationRecordService.ts` — create/submit/resubmit now enqueue an outbox op **in the same Dexie transaction** as the record mutation. `simulateSyncAllQueued` was **deleted**.
- UI: `src/ui/system/SyncControls.tsx` (real "Sync now" button + status, mounted in `App.tsx`), `ConflictBanner.tsx` (in `RecordDetailDialog`), `useOnlineStatus.ts` (extracted from `OfflineBadge`).

Tests added (21, all green): loopback transport, flush service (offline→queue→synced, conflict, rejected, adopt, retry, transport-failure revert, idempotent re-flush), outbox unit, **v1→v2 Dexie migration**, and the sync UI.

### Phase 2 — Offline readiness ⬜ NOT STARTED (next up)
- **Catalog staleness:** persist `catalogMeta` (version + `loadedAt`) when `catalogLoader.loadCatalog` runs; add `src/catalog/catalogStatus.ts` (age + threshold) and a `CatalogStatusBanner`. Add an HTTP-backed `CatalogSource` for delta refresh. Key point: a record submitted against a stale catalog is still valid because `productSnapshot` froze the version — staleness is a **warning, not a blocker**.
- **Offline-tolerant auth/flush gating:** persist the selected role/actor (currently `SessionContext` + demo actors) to `localStorage` so identity survives offline reload; flush only when online AND identity present; capture/submit always allowed. Design the 401 seam (transport 401 → "needs reauth", keep the queue).
- **Weather deferred enrichment:** offline capture sets `weatherSnapshot.source="manual"` (satisfies the `MISSING_WIND` rule); on flush, optionally attach the nearest NWS observation as *additional* metadata, **only while pre-lock** — never mutate a locked/exported record, never overwrite operator values. (`weatherService.ts` / `nwsWeatherAdapter.ts` exist.)

### Phase 3 — Hardening ⬜ NOT STARTED
- **Background Sync API:** switch `vite.config.ts` PWA from `generateSW` to `injectManifest` with a custom `src/pwa/sw.ts` that `postMessage`s clients to run `flushOutbox` on a `sync`/`periodicsync` tag. Keep foreground/online triggers as the baseline (**iOS Safari lacks Background Sync** — it's an enhancement, never the only path).
- **Content-hash integrity:** `src/application/integrity.ts` — canonicalize `contractorInputs + productSnapshot + ordered events`, SHA-256 via Web Crypto, store `contentHash` at lock (Dexie `version(3)`). Client computes a "soft" hash now; server authoritative later.

---

## How to verify (run these after picking up)

```bash
npx vitest run        # 345 tests should pass (324 pre-existing + 21 new)
npx tsc -b --noEmit   # clean
npm run build         # clean (PWA SW generated)
npm run dev           # manual: see golden path below
```

Manual golden path (loopback transport, the default with no `VITE_API_URL`):
1. Contractor role → fill the draft form → a record appears. Open DevTools → Network → Offline.
2. Create/submit while offline → record shows a sync chip; the outbox holds the ops.
3. Go back online → the flush controller (or "Sync now") drains the outbox → chip → `Synced`.
4. To exercise conflict: in the record detail dialog, a `sync_failed` record shows the `ConflictBanner` with "Use server copy" / "Retry sync".

> Note from the last session: the browser click-through above was **not** manually performed; the path is covered end-to-end in jsdom by `SyncControls.test.tsx` + `syncService.test.ts`. Worth a real browser pass.

---

## Gotchas / known issues

- **`eslint .` crashes** repo-wide because it walks into `reference/vendor-docs/` (cloned upstream repos with their own broken eslint configs). This is **pre-existing**, not from this work. Lint your own files with explicit paths, e.g. `npx eslint src/application/sync src/ui/system/SyncControls.tsx`. A proper fix is to add `reference`/`server` to `globalIgnores` in `eslint.config.js` (was tried then reverted to keep the sync change focused — feel free to land it separately).
- **`reference/vendor-docs/`** (~50k upstream files) and `data/raw/epa/*.xlsx` (98 MB) are intentionally gitignored / excluded from vite watch. Don't commit them.
- **Dexie is forward-only.** Any further schema bump needs an upgrade path + a migration test (see `src/db/migration.test.ts` for the pattern). Phase 3 will add `version(3)`.
- **Auth is demo-grade** (`SessionContext` + `DEMO_*_ACTOR`), client-side only. Real auth lands with the backend. See the Trust Boundary section in `CLAUDE.md`.

---

## Key files to orient quickly

| Area | Path |
|---|---|
| Project rules / trust boundary / Dexie rules | `CLAUDE.md` |
| Domain Zod (source of truth) | `src/domain/schemas.ts` |
| Lifecycle services | `src/application/applicationRecordService.ts` |
| Compliance rules (reused server + loopback) | `src/application/complianceRules.ts` |
| **Sync layer (Phase 1)** | `src/application/sync/*` |
| DB schema + versions | `src/db/fieldlogDb.ts` |
| API contract the client targets | `docs/architecture/api/openapi.yaml` |
| What the client must change for the real API | `docs/architecture/api/client_migration_notes.md` |
| Backend skeleton | `server/` |

## Immediate next actions for the next agent
1. **Commit the Phase 1 sync work** (enumerate paths; not `-A`).
2. Start **Phase 2** — recommend leading with **catalog staleness** (highest-risk gap: offline RUP checks silently assume the catalog is present).
3. Optionally land the `eslint.config.js` ignore fix as its own small commit so `npm run lint` works repo-wide.
