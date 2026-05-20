// Uniform error model (handoff constraint #5). Internal exceptions are mapped to
// safe public codes; the wire body is always { error: { code, message, requestId } }
// and never carries stack traces, SQL, or ORM internals.

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "RECORD_LOCKED"
  | "STATUS_TRANSITION_INVALID"
  | "IDEMPOTENCY_CONFLICT"
  | "CONFLICT_STALE_RECORD"
  | "DUPLICATE"
  | "RATE_LIMITED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  RECORD_LOCKED: 409,
  STATUS_TRANSITION_INVALID: 409,
  IDEMPOTENCY_CONFLICT: 409,
  CONFLICT_STALE_RECORD: 412,
  DUPLICATE: 409,
  RATE_LIMITED: 429,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

export type FieldIssue = { path: string; message: string };

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: FieldIssue[];

  constructor(code: ErrorCode, message: string, details?: FieldIssue[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: FieldIssue[];
  };
};

const SAFE_GENERIC_MESSAGE = "An unexpected error occurred.";

// Convert any thrown value into a safe public envelope. Unknown errors collapse to
// INTERNAL/500 with a generic message so nothing internal leaks to the client.
export function toErrorBody(err: unknown, requestId: string): {
  statusCode: number;
  body: ErrorBody;
} {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      body: {
        error: {
          code: err.code,
          message: err.message,
          requestId,
          ...(err.details ? { details: err.details } : {}),
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: { error: { code: "INTERNAL", message: SAFE_GENERIC_MESSAGE, requestId } },
  };
}
