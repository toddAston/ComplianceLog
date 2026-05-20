# FieldLog API — containers

## Run locally

```bash
cd server
cp .env.example .env          # fill in the CHANGE_ME secrets (32+ byte randoms)
docker compose up --build
```

`docker-compose.override.yml` is auto-merged and runs the API **from source with hot
reload** (a full Node image), exposing Postgres on `5432` and Redis on `6379` for
inspection. Bring-up order is enforced: Postgres becomes healthy → the one-shot
`migrate` service applies `migrations/0001_initial_schema.sql` (idempotent) → Redis
healthy → the API starts. Probe it:

```bash
curl localhost:8080/healthz   # {"status":"ok"}
curl localhost:8080/readyz    # {"status":"ready","checks":{"postgres":"up","redis":"up"}}
```

Requires Docker Compose ≥ 2.24 (the override uses `build: !reset null`).

## How the production image differs from compose

Running `docker compose -f docker-compose.yml up --build` (without the override)
builds the **real** production image from `Dockerfile`:

- Three stages: `deps` (pruned prod `node_modules`) → `build` (`tsup` bundles
  `dist/server.js`, inlining the client Zod from `/src/domain`) → `runtime`
  (`gcr.io/distroless/nodejs22-debian12:nonroot`).
- No shell, no npm, no build tools, no source in the final image; runs as `nonroot`.
- Migrations do **not** run from the API; a separate one-shot container applies them
  first. In production that one-shot runs `drizzle-kit migrate`.
- Base images are tag-pinned for a buildable fresh checkout — **pin by digest for
  production** (commands in `Dockerfile`).

## Environment variables read at startup

The canonical list with descriptions is `server/.env.example`. Summary:

| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT`, `LOG_LEVEL` | Runtime basics. |
| `DATABASE_URL` | Postgres connection (system of record). |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose Postgres + `DATABASE_URL` assembly. |
| `REDIS_URL` | Rate-limit store + BullMQ broker. |
| `SESSION_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Session/token signing (32+ bytes each). |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS` | Token lifetimes. |
| `ARGON2_MEMORY_KIB`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM` | Password-hash work factors. |
| `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_AUTH_WINDOW` | Auth rate-limit policy. |

No secret is baked into the image; every value is read from the environment at
startup, and secrets in production come from the platform secret manager.
