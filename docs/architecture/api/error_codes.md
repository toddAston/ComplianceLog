# FieldLog API — error codes

Every error response uses the envelope `{ "error": { "code", "message", "requestId" } }`
(optionally `details: [{ path, message }]`). `code` is stable and machine-readable;
`message` is safe for display and never contains stack traces, SQL, or ORM internals
(handoff constraint #5). Source of truth: `server/src/lib/errors.ts`.

| Code | HTTP | Fires when | Client recovery | Logged |
|---|---|---|---|---|
| `AUTH_REQUIRED` | 401 | No/!invalid/expired bearer token on a non-public route; malformed actor token. | Refresh the access token (`/auth/refresh`); if that fails, re-login. | `requestId`, route, ip (no token contents). |
| `FORBIDDEN` | 403 | Authenticated but role/ownership check fails (applicator acting on another's record; non-manager calling review). | Do not retry; surface "not permitted". | `requestId`, userId, orgId, recordId, required role. |
| `NOT_FOUND` | 404 | Resource missing, or exists in another org (tenant isolation hides existence). | Refetch the list; the row may have been removed or is out of scope. | `requestId`, userId, orgId, resource id. |
| `VALIDATION_FAILED` | 422 | Payload well-formed but fails Zod/domain rules (bad acres, missing attestation, blocked compliance rule, missing `Idempotency-Key`). `details` carries field paths. | Fix the flagged fields; re-submit. Do not blind-retry. | `requestId`, userId, orgId, field paths (not values). |
| `VALIDATION_FAILED` (schema) | 400 | Request body fails the route JSON schema (wrong types, malformed JSON). | Fix request shape. | `requestId`, validation paths. |
| `RECORD_LOCKED` | 409 | Mutation attempted on a `locked`/`exported` record (other than `locked → exported`). | Stop; the record is immutable evidence. Show the locked state. | `requestId`, userId, orgId, recordId, attempted op. |
| `STATUS_TRANSITION_INVALID` | 409 | Lifecycle hop not allowed from the current `workflowStatus` (e.g. submitting a non-draft). | Refetch the record; its status changed under you. | `requestId`, recordId, from→to. |
| `IDEMPOTENCY_CONFLICT` | 409 | Same `Idempotency-Key` reused with a different payload than the stored result. | Use a fresh key for a new operation. | `requestId`, key, userId. |
| `CONFLICT_STALE_RECORD` | 412 | `If-Match` ETag does not match current state (client's copy is stale). | Refetch, reapply edits, retry with the new ETag. | `requestId`, recordId, sent vs current etag. |
| `DUPLICATE` | 409 | Unique constraint hit (duplicate farm/field/applicator name within org). | Use a different name or reuse the existing entity. | `requestId`, orgId, entity, name. |
| `RATE_LIMITED` | 429 | Per-IP/user/token rate limit exceeded (auth endpoints + sync). `Retry-After` header set. | Back off until `Retry-After`; exponential backoff for sync. | `requestId`, ip, userId, bucket. |
| `NOT_IMPLEMENTED` | 501 | Endpoint specified in `openapi.yaml` but not built in the current server. | Treat as unavailable; do not retry. | `requestId`, route. |
| `INTERNAL` | 500 | Any unmapped exception (DB down, bug). Message is always generic. | Retry idempotent ops with backoff; report `requestId` to support. | `requestId` + full error stack (server-side only). |

## Notes

- **422 vs 400.** 400 means the request couldn't be understood against the route
  schema; 422 means it was understood but violates a domain/Zod rule. Both use code
  `VALIDATION_FAILED`; the HTTP status distinguishes them.
- **No enumeration.** `NOT_FOUND` is returned for cross-tenant access rather than 403,
  so a caller cannot probe for the existence of other orgs' records.
- **`requestId`** equals the Fastify request id (also in every log line), so a user
  report maps directly to server logs.
