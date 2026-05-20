import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors";

// Endpoints fully specified in openapi.yaml but not implemented in the bootable
// skeleton. They authenticate (default-auth applies) and return a clean 501 so the
// surface is discoverable and the contract is testable. Real handlers replace these.
const NOT_IMPLEMENTED: ReadonlyArray<[string, string]> = [
  ["GET", "/v1/organization"],
  ["GET", "/v1/farms"],
  ["POST", "/v1/farms"],
  ["PATCH", "/v1/farms/:farmId"],
  ["GET", "/v1/fields"],
  ["POST", "/v1/fields"],
  ["PATCH", "/v1/fields/:fieldId"],
  ["GET", "/v1/applicators"],
  ["POST", "/v1/applicators"],
  ["GET", "/v1/products"],
  ["GET", "/v1/application-records"],
  ["GET", "/v1/application-records/:recordId"],
  ["PATCH", "/v1/application-records/:recordId"],
  ["POST", "/v1/application-records/:recordId/review"],
  ["POST", "/v1/application-records/:recordId/resubmit"],
  ["POST", "/v1/application-records/:recordId/export"],
  ["GET", "/v1/application-records/:recordId/events"],
  ["GET", "/v1/exports/:jobId"],
  ["POST", "/v1/sync/batch"],
];

const PUBLIC_AUTH: ReadonlyArray<[string, string]> = [
  ["POST", "/v1/auth/login"],
  ["POST", "/v1/auth/refresh"],
  ["POST", "/v1/auth/logout"],
  ["POST", "/v1/auth/password-reset/request"],
  ["POST", "/v1/auth/password-reset/confirm"],
];

export function registerStubRoutes(app: FastifyInstance): void {
  const handler = async () => {
    throw new AppError("NOT_IMPLEMENTED", "Endpoint specified but not yet implemented.");
  };

  for (const [method, url] of NOT_IMPLEMENTED) {
    app.route({ method, url, handler });
  }
  for (const [method, url] of PUBLIC_AUTH) {
    app.route({ method, url, config: { public: true }, handler });
  }
}
