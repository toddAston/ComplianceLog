# Client migration notes

What the existing offline-first React/Dexie client must change to talk to this API.
Pragmatic and minimal — the local DB stays as the offline cache; the server becomes the
system of record once sync exists.

## 1. Add a network layer behind the existing service functions

The service functions in `src/application/*` already mediate all persistence (Architecture
Rules in CLAUDE.md). Add a network call inside each, gated by online state — keep writing to
Dexie locally first (offline-first), then enqueue a sync op.

| Client function (`src/application/`) | Server endpoint | When the call fires |
|---|---|---|
| `applicationRecordService.createDraftApplicationRecord` | `POST /application-records` | On flush (created `local_only` first). |
| `applicationRecordService.submitApplicationRecord` | `POST /application-records/{id}/submit` | On flush (queued at submit). |
| `applicationRecordService.acceptAndLockApplicationRecord` | `POST /application-records/{id}/review` `{decision:"accepted"}` | Manager online action. |
| `applicationRecordService.requestCorrectionForApplicationRecord` | `POST /application-records/{id}/review` `{decision:"needs_correction"}` | Manager online action. |
| `applicationRecordService.resubmitCorrectedApplicationRecord` | `POST /application-records/{id}/resubmit` | On flush. |
| `applicationRecordService.simulateSyncAllQueued` | **replaced by** `POST /sync/batch` | Real flush (see §3). |
| `applicationRecordExport.exportLockedApplicationRecord` | `POST /application-records/{id}/export` → `GET /exports/{jobId}` | Manager export; now async (job + poll). |
| `contractorService.inviteContractor` | `POST /applicators` | Manager invite; server issues the link. |
| `farmService.createFarm` / `renameFarm` | `POST /farms` / `PATCH /farms/{id}` | Manager edits. |
| `fieldService.createField` / `updateField` | `POST /fields` / `PATCH /fields/{id}` | Manager edits. |
| `db/queries.ts` live queries | `GET` list endpoints (hydrate cache) | On reconnect / pull-to-refresh. |

## 2. Schemas that need a server-shape variant

Derive these from the existing Zod (extend, don't fork) in a new `src/domain/serverSchemas.ts`:

- **`applicationRecordSchema`** → add `etag: z.string()` and `createdByUserId: z.string().optional()`.
  Persist `etag` in Dexie so the client can send `If-Match` / `baseEtag` on the next mutation.
- **`applicatorInviteResult`** → replace the local `inviteToken`/`inviteLink` with the
  server's `inviteLink` (drop local token generation in `contractorService.ts`).
- **No change** to `contractorInputs`, `managerInputs`, `system`, enums — the server imports
  these verbatim, so the wire shape already matches what the client produces. The string
  fields (`acresTreated`, `applicationDate`, `startTime`) stay strings on the wire; the
  server does the numeric/date/time coercion.

Add a Dexie schema bump (per CLAUDE.md "Dexie Schema Upgrades") to store `etag` and a
per-record `syncError` field; additive, so a `db.version(2)` with the new optional fields
plus a migration test (`fake-indexeddb`) covering a v1 row surviving the bump.

## 3. Sync flush

Add `src/application/syncService.ts`:

- **What:** collects records with `syncStatus ∈ {queued, sync_failed}`, builds a
  `SyncBatchRequest` (≤100 ops, each with `opId`, `kind`, `recordId`, `baseEtag`, payload),
  `POST /sync/batch` with one `Idempotency-Key` per batch.
- **When:** on `online` event (`navigator.onLine` / `window 'online'`), on app foreground,
  on a periodic timer (e.g. 60s) while online, and on an explicit "Sync now" button.
- **Status transitions (client side):** set `syncing` before the request; on the response,
  per op: `applied` → write the server's canonical record + events into Dexie, set `synced`;
  `conflict` → set `sync_failed`, store the server's current record for a rebase UI; `rejected`
  → set `sync_failed`, surface the error.
- **Partial failure:** the batch is not all-or-nothing — apply the `applied` ops, leave the
  rest `sync_failed` for the next flush. Never drop a local record because one op failed.
- **Events:** discard optimistic local events for a record once the server's events arrive;
  the server is the author of record history.

## 4. Replace the demo session with real auth

Today: `SessionProvider` / `useSessionRole` / `DEMO_APPLICATOR_ACTOR` /
`DEMO_MANAGER_ACTOR` (`src/ui/demoSession.ts`) are a client-side toggle (CLAUDE.md "Trust
Boundary").

- Add a login screen calling `POST /auth/login`; store the access token in memory (not
  localStorage) and rely on the HttpOnly refresh cookie.
- Replace the `ActorContext` passed to service functions with the authenticated user from
  the token response (`User`); drop the `DEMO_*_ACTOR` constants.
- Add an axios/fetch wrapper that attaches `Authorization: Bearer`, refreshes on 401 via
  `POST /auth/refresh`, and retries once.
- Role gating in the UI stays for UX, but is now backed by the server's role claim — and is
  no longer the security boundary (the server re-checks every request).

## 5. Behavioral changes to surface in the UI

- **Export is async:** show a "preparing PDF" state and poll `GET /exports/{jobId}`; the
  download appears when the job succeeds (signed URL, short TTL).
- **Stale-record conflicts:** a `412 CONFLICT_STALE_RECORD` or a sync `conflict` means a
  manager changed the record while you were offline — prompt to refresh before re-editing.
- **Server compliance block:** submit can now fail server-side with the same compliance
  message even if the client passed — display the returned `message` verbatim.
