import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { Redis } from "ioredis";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export type Resources = {
  sql: ReturnType<typeof postgres>;
  db: Db;
  redis: Redis;
  close: () => Promise<void>;
  pingPostgres: () => Promise<boolean>;
  pingRedis: () => Promise<boolean>;
};

export function createResources(databaseUrl: string, redisUrl: string): Resources {
  const sqlClient = postgres(databaseUrl, { max: 10, idle_timeout: 20 });
  const db = drizzle(sqlClient, { schema });
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  return {
    sql: sqlClient,
    db,
    redis,
    async pingPostgres() {
      try {
        await sqlClient`select 1`;
        return true;
      } catch {
        return false;
      }
    },
    async pingRedis() {
      try {
        if (redis.status !== "ready") await redis.connect();
        const pong = await redis.ping();
        return pong === "PONG";
      } catch {
        return false;
      }
    },
    async close() {
      await Promise.allSettled([sqlClient.end({ timeout: 5 }), redis.quit()]);
    },
  };
}

export { schema, sql };
