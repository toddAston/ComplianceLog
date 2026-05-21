# FieldLog

Offline-first pesticide application recordkeeping for agricultural operations.
Captures the evidence a Missouri commercial applicator is legally required to keep —
nothing more, nothing less.

This is a working v0.1 application, not a demo. The compliance engine is wired to
real Missouri and federal regulatory citations. The issue log ([ISSUES.md](./ISSUES.md))
lists 72 known gaps openly — read it before depending on any output this app produces.

---

## What it actually does today

- Contractor drafts an application record and submits it (offline-capable via IndexedDB)
- Record is frozen at submission with a product snapshot
- Manager reviews, accepts or flags for correction, then locks
- Locked record can be exported as a PDF audit packet
- Compliance checklist runs against every record at submit time, citing the specific
  Missouri regulation paragraph that applies to each check
- Role switching (contractor / manager) is a client-side toggle — demo-grade only,
  not authorization

## What is not ready for production

- The server (`server/`) is a skeleton. It is not deployed and the client does not talk
  to it. All data lives in the browser's IndexedDB.
- Auth is `localStorage` + React context. There is no real login.
- 26 high-severity and 2 critical issues are open — see [ISSUES.md](./ISSUES.md).

---

## Running the client app

```sh
npm install
npm run dev
```

Opens at `http://localhost:5173` (or next available port). Works entirely offline —
no server required.

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript type-check only, no emit |
| `npm run lint` | ESLint (run by path — `eslint .` crashes on `reference/vendor-docs/`, see DA-011 in ISSUES.md) |

## Running the client tests

```sh
npm test              # watch mode
npx vitest run        # single run, all tests
npx vitest run src/application/applicationRecordService.test.ts  # single file
npx vitest -t "submit"  # tests matching a name pattern
```

63 test files covering the golden path, compliance rules, sync layer, Dexie schema
migration, and UI components. Zero skipped tests.

---

## Running the server (skeleton)

The server requires Node 22, Postgres 16, and Redis 7. The easiest path is Docker Compose.
Docker has not been verified on the current dev machine (see DA-001 in ISSUES.md).

```sh
cd server
cp .env.example .env
# Edit .env — change every CHANGE_ME_* value before running
docker compose up --build
```

API available at `http://localhost:8080`. Health check: `GET /healthz`.

**Without Docker:**

```sh
cd server
npm install
# Provide DATABASE_URL and REDIS_URL in the environment, then:
npm run dev           # tsx watch — restarts on file changes
npx vitest run        # 31 server tests (no Postgres required — tests use a fake db)
npm run typecheck
npm run db:generate   # regenerate Drizzle migrations after schema changes
npm run db:migrate    # apply migrations to the target database
```

### Implemented server routes

Only two real handlers exist today. Everything else returns `501 Not Implemented`.

- `POST /v1/application-records` — create a draft record
- `POST /v1/application-records/:recordId/submit` — submit and generate a product snapshot

---

## Project structure

```
src/
  application/      # service layer — all business logic, compliance engine, sync
  db/               # Dexie schema, seed data, migration tests
  domain/           # Zod schemas (source of truth for all types)
  ui/               # React components, pages, context
server/
  src/              # Fastify + Drizzle + BullMQ skeleton
  migrations/       # Hand-written SQL migrations (0001, 0002)
docs/
  architecture/     # API spec, OpenAPI, design notes
  build/            # Compliance check catalogue and regulatory citations
  product/          # Canonical design model JSON
research/
  regulatory/       # Missouri 2 CSR 70-25 PDF, APPRIL guides
```

---

## Regulatory scope

Records are structured to satisfy:

- Missouri 2 CSR 70-25.120 — application record content (fields A–M)
- RSMo 281.035 / 281.037 / 281.045 — certified, noncertified, and public operator requirements
- FIFRA §12(a)(2)(G) — label compliance attestation

FieldLog is an evidence capture tool. It does not adjudicate compliance or substitute
for legal review. The compliance checklist flags issues; it does not decide them.

---

## Known issues

See [ISSUES.md](./ISSUES.md) for the full list. The two criticals as of 2026-05-21:

- **CE-001** — No compliance rule enforces a certified applicator license number on
  every applicable record (matrix #9, P0 under 2 CSR 70-25.120(4)(A))
- **CM-001** — `applicatorSchema` has 8 fields (including `licenseCategoryCodes`,
  which is the foundation for the supervisor-certified-in-category rule) that have
  no corresponding column in the server's Drizzle schema

---

**Last updated:** 2026-05-21 — v0.1, client functional, server skeleton only
