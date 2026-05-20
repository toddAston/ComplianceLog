import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";

import { loadEnv, type Env } from "./env";
import { createResources, type Resources } from "./db/client";
import { registerErrorEnvelope } from "./plugins/errorEnvelope";
import { registerAuth } from "./plugins/auth";
import { registerHealthRoutes } from "./routes/health";
import { registerRecordRoutes } from "./routes/records";
import { registerStubRoutes } from "./routes/stub";

declare module "fastify" {
  interface FastifyInstance {
    resources: Resources;
  }
}

// Pure factory so tests can build the app with injected resources (e.g. fakes) and
// drive it via app.inject() without opening a socket.
export function buildApp(resources: Resources, env: Env): FastifyInstance {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    genReqId: () => randomUUID(),
    trustProxy: true,
  });

  app.decorate("resources", resources);

  registerErrorEnvelope(app);
  registerAuth(app);
  registerHealthRoutes(app);
  registerRecordRoutes(app);
  registerStubRoutes(app);

  return app;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const resources = createResources(env.DATABASE_URL, env.REDIS_URL);
  const app = buildApp(resources, env);

  // Graceful shutdown: stop accepting, drain in-flight, close DB + Redis pools.
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "shutting down");
    try {
      await app.close();
      await resources.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "error during shutdown");
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ host: "0.0.0.0", port: env.PORT });
}

// Auto-start outside of tests (vitest sets NODE_ENV=test).
if (process.env.NODE_ENV !== "test") {
  void main();
}
