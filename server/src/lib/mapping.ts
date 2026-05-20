import { AppError, type FieldIssue } from "./errors";

// Wire <-> DB shape bridge. The client Zod stores acresTreated/applicationDate/
// startTime as strings (src/domain/schemas.ts:132,140,141); constraint #11 mandates
// numeric/date/time columns. This is the single place that coercion happens, so the
// "Zod is source of truth on the wire, real columns in the DB" split stays explicit.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

// "" / undefined -> null; otherwise must parse to a finite, non-negative number.
export function acresToDb(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    throw validation([
      { path: "contractorInputs.acresTreated", message: "Acres must be a number." },
    ]);
  }
  if (n < 0) {
    throw validation([
      { path: "contractorInputs.acresTreated", message: "Acres cannot be negative." },
    ]);
  }
  // numeric column accepts a string; keep the caller's precision.
  return trimmed;
}

export function acresFromDb(value: string | null): string {
  return value ?? "";
}

export function dateToDb(value: string): string {
  const trimmed = value?.trim();
  if (!trimmed || !DATE_RE.test(trimmed)) {
    throw validation([
      { path: "contractorInputs.applicationDate", message: "Expected YYYY-MM-DD." },
    ]);
  }
  return trimmed;
}

// Postgres `time` may echo back as HH:mm:ss; normalize to HH:mm for the client.
export function timeFromDb(value: string | null): string {
  if (!value) return "";
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export function timeToDb(value: string, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed || !TIME_RE.test(trimmed)) {
    throw validation([{ path: field, message: "Expected HH:mm time." }]);
  }
  return trimmed;
}

export function optionalTimeToDb(
  value: string | undefined,
  field: string
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return timeToDb(trimmed, field);
}

function validation(details: FieldIssue[]): AppError {
  return new AppError("VALIDATION_FAILED", "Request failed validation.", details);
}
