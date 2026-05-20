import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../lib/errors";
import type { UserRole } from "../../../src/domain/types";

// DEMO-GRADE STUB. This decodes an unsigned base64url actor token so the skeleton
// can exercise role/ownership/tenant logic end-to-end. It is NOT real auth and is
// trivially forgeable — replace with verified JWT/session validation before any
// production deploy (CLAUDE.md "Trust Boundary"; client_migration_notes.md §auth).
export type Actor = {
  userId: string;
  organizationId: string;
  role: UserRole;
  displayName: string;
};

declare module "fastify" {
  interface FastifyRequest {
    actor?: Actor;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

export function decodeActorToken(token: string): Actor {
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw new AppError("AUTH_REQUIRED", "Malformed authorization token.");
  }
  const a = json as Partial<Actor>;
  if (!a || typeof a.userId !== "string" || typeof a.organizationId !== "string") {
    throw new AppError("AUTH_REQUIRED", "Authorization token missing required claims.");
  }
  if (a.role !== "applicator" && a.role !== "manager") {
    throw new AppError("AUTH_REQUIRED", "Authorization token has an invalid role.");
  }
  return {
    userId: a.userId,
    organizationId: a.organizationId,
    role: a.role,
    displayName: typeof a.displayName === "string" ? a.displayName : a.userId,
  };
}

export function getActor(req: FastifyRequest): Actor {
  if (!req.actor) {
    throw new AppError("AUTH_REQUIRED", "Authentication required.");
  }
  return req.actor;
}

export function requireRole(req: FastifyRequest, role: UserRole): Actor {
  const actor = getActor(req);
  if (actor.role !== role) {
    throw new AppError("FORBIDDEN", `This action requires the ${role} role.`);
  }
  return actor;
}

export function registerAuth(app: FastifyInstance): void {
  // Default-authenticated: every route requires a bearer token unless it opts out
  // with `config: { public: true }` (health + auth endpoints).
  app.addHook("onRequest", async (req) => {
    if (req.routeOptions.config?.public) return;

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("AUTH_REQUIRED", "Authentication required.");
    }
    req.actor = decodeActorToken(header.slice("Bearer ".length).trim());
  });
}
