import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./server";
import { loadEnv } from "./env";
import type { Resources } from "./db/client";

const env = loadEnv({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/test",
  REDIS_URL: "redis://localhost:6379",
  SESSION_SECRET: "s".repeat(32),
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "r".repeat(32),
} as NodeJS.ProcessEnv);

function fakeResources(over: Partial<Resources> = {}): Resources {
  return {
    sql: {} as Resources["sql"],
    db: {} as Resources["db"],
    redis: {} as Resources["redis"],
    pingPostgres: async () => true,
    pingRedis: async () => true,
    close: async () => {},
    ...over,
  };
}

const managerToken = Buffer.from(
  JSON.stringify({
    userId: "u1",
    organizationId: "o1",
    role: "manager",
    displayName: "Manager One",
  })
).toString("base64url");

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("health routes", () => {
  it("GET /healthz returns 200 without touching dependencies", async () => {
    app = buildApp(fakeResources(), env);
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200 ready when both deps are up", async () => {
    app = buildApp(fakeResources(), env);
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "ready",
      checks: { postgres: "up", redis: "up" },
    });
  });

  it("GET /readyz returns 503 not_ready when Postgres is down", async () => {
    app = buildApp(fakeResources({ pingPostgres: async () => false }), env);
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      status: "not_ready",
      checks: { postgres: "down", redis: "up" },
    });
  });
});

describe("auth + error envelope", () => {
  it("rejects a protected route without a bearer token (401 AUTH_REQUIRED)", async () => {
    app = buildApp(fakeResources(), env);
    const res = await app.inject({ method: "GET", url: "/v1/products" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("AUTH_REQUIRED");
    expect(res.json().error.requestId).toBeTruthy();
  });

  it("rejects a forged/malformed token", async () => {
    app = buildApp(fakeResources(), env);
    const res = await app.inject({
      method: "GET",
      url: "/v1/products",
      headers: { authorization: "Bearer not-base64-json" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("AUTH_REQUIRED");
  });

  it("returns 501 NOT_IMPLEMENTED for a specced-but-stubbed route with valid auth", async () => {
    app = buildApp(fakeResources(), env);
    const res = await app.inject({
      method: "GET",
      url: "/v1/products",
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(res.statusCode).toBe(501);
    expect(res.json().error.code).toBe("NOT_IMPLEMENTED");
  });

  it("returns a NOT_FOUND envelope for an unknown route", async () => {
    app = buildApp(fakeResources(), env);
    const res = await app.inject({ method: "GET", url: "/v1/nope", headers: { authorization: `Bearer ${managerToken}` } });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("login is public (no token required) — reaches the stub, not the auth gate", async () => {
    app = buildApp(fakeResources(), env);
    const res = await app.inject({ method: "POST", url: "/v1/auth/login" });
    // Public route passes auth; the stub then returns 501 (not 401).
    expect(res.statusCode).toBe(501);
  });
});
