import type {
  SyncBatchRequest,
  SyncBatchResponse,
  SyncRequestOptions,
  SyncTransport,
} from "./transport";

// Real-server transport. Hits POST {baseUrl}/sync/batch per the OpenAPI spec,
// attaching the bearer token and a per-batch Idempotency-Key. Compiles and is wired
// today, but is only exercised end-to-end once server/ is deployed (no live backend
// yet — see client_migration_notes.md). Until then defaultTransport selects loopback.
export function createHttpTransport(
  baseUrl: string,
  getToken?: () => string | undefined
): SyncTransport {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    async syncBatch(
      request: SyncBatchRequest,
      options: SyncRequestOptions
    ): Promise<SyncBatchResponse> {
      const token = options.token ?? getToken?.();
      const res = await fetch(`${root}/sync/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": options.idempotencyKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        // Surface a transport-level failure; flushOutbox treats a throw as
        // "retry later" and leaves the outbox intact.
        let detail = `${res.status} ${res.statusText}`;
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          if (body?.error?.message) detail = body.error.message;
        } catch {
          // non-JSON error body — keep the status line.
        }
        throw new Error(`sync/batch failed: ${detail}`);
      }

      return (await res.json()) as SyncBatchResponse;
    },
  };
}
