import type { ZodType, ZodError } from "zod";
import { AppError, type FieldIssue } from "./errors";

// Re-validate every payload against the client Zod source of truth at the API
// boundary (handoff constraint #7). A failure becomes a safe 422 with field paths.
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Request failed validation.",
      zodIssues(result.error)
    );
  }
  return result.data;
}

function zodIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}
