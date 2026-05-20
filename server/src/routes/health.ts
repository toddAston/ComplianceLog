import type { FastifyInstance } from "fastify";

// Liveness vs. readiness (handoff §13.3). /healthz never touches dependencies;
// /readyz actually probes Postgres and Redis and returns 503 if either is down.
export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/healthz", { config: { public: true } }, async () => {
    return { status: "ok" as const };
  });

  app.get("/readyz", { config: { public: true } }, async (_req, reply) => {
    const [pg, redis] = await Promise.all([
      app.resources.pingPostgres(),
      app.resources.pingRedis(),
    ]);
    const ready = pg && redis;
    reply.code(ready ? 200 : 503);
    return {
      status: ready ? ("ready" as const) : ("not_ready" as const),
      checks: {
        postgres: pg ? ("up" as const) : ("down" as const),
        redis: redis ? ("up" as const) : ("down" as const),
      },
    };
  });
}
