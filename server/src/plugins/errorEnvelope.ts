import type { FastifyInstance, FastifyError } from "fastify";
import { AppError, toErrorBody, type FieldIssue } from "../lib/errors";

// Centralizes the safe error envelope. Fastify schema-validation failures map to a
// 400 VALIDATION_FAILED with field details; everything unrecognized collapses to
// INTERNAL/500 (no leak). 5xx is logged with the full error; the client never sees it.
export function registerErrorEnvelope(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err.validation) {
      const details: FieldIssue[] = err.validation.map((v) => ({
        path: v.instancePath || v.schemaPath,
        message: v.message ?? "Invalid value.",
      }));
      reply.code(400).send({
        error: {
          code: "VALIDATION_FAILED",
          message: "Request body failed validation.",
          requestId: req.id,
          details,
        },
      });
      return;
    }

    const { statusCode, body } = toErrorBody(err, req.id);
    // Only genuinely unknown exceptions are error-logged (these are the ones that
    // collapse to INTERNAL/500). Known AppErrors — including 501 stubs — are expected
    // control flow and logged at the normal request level by Fastify.
    if (!(err instanceof AppError)) {
      req.log.error({ err }, "unhandled error");
    }
    reply.code(statusCode).send(body);
  });

  app.setNotFoundHandler((req, reply) => {
    const { statusCode, body } = toErrorBody(
      new AppError("NOT_FOUND", "Resource not found."),
      req.id
    );
    reply.code(statusCode).send(body);
  });
}
