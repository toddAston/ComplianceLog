import { useCallback, useEffect, useState } from "react";
import { useOnlineStatus } from "../../ui/system/useOnlineStatus";
import { defaultTransport } from "./defaultTransport";
import { flushOutbox, type FlushSummary } from "./syncService";
import type { SyncTransport } from "./transport";

const PERIODIC_MS = 30_000;

export type FlushState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; summary: FlushSummary }
  | { kind: "error"; message: string };

const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

export type UseSyncFlushOptions = {
  // When true, the hook registers three auto-flush effects (online transition,
  // foreground visibility, periodic catch-up). When false (default), only the
  // manual `flush()` returned below runs the flush — mounting the hook has no
  // side effect on the outbox.
  //
  // Defaulting to false matters because the loopback transport "applies"
  // outbox ops synchronously: any component that mounted this hook with auto
  // -flush on would silently flip `syncStatus: local_only` → `synced` at boot.
  // That happened when `<SyncControls />` landed in `AppHeader` — broke the
  // "draft persists across remount" test and would muddy the demo by syncing
  // records before the operator clicked "Sync now".
  enableAutoFlush?: boolean;
};

// Drives every flush trigger (online transition, foreground, periodic, manual) from
// one place, so there is a single flush loop for the app. Capture/submit are never
// gated here — only the flush is gated on connectivity (offline → no-op).
export function useSyncFlush(
  transport: SyncTransport = defaultTransport,
  options: UseSyncFlushOptions = {}
) {
  const { enableAutoFlush = false } = options;
  const online = useOnlineStatus();
  const [state, setState] = useState<FlushState>({ kind: "idle" });

  // Silent background flush used by effects: no setState (avoids cascading renders),
  // and record changes surface through Dexie live queries. Transport failures are
  // swallowed — the outbox is left intact and retried on the next trigger.
  const autoFlush = useCallback(async () => {
    if (!isOnline()) return;
    try {
      await flushOutbox(transport);
    } catch {
      // offline mid-flush; ops remain pending for the next attempt.
    }
  }, [transport]);

  // Manual flush with visible status for the "Sync now" button.
  const flush = useCallback(async (): Promise<FlushSummary | undefined> => {
    if (!isOnline()) return undefined;
    setState({ kind: "running" });
    try {
      const summary = await flushOutbox(transport);
      setState({ kind: "done", summary });
      return summary;
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Sync failed.",
      });
      return undefined;
    }
  }, [transport]);

  // Flush when connectivity returns (and once on mount if already online).
  useEffect(() => {
    if (!enableAutoFlush) return;
    if (online) void autoFlush();
  }, [enableAutoFlush, online, autoFlush]);

  // Flush when the app returns to the foreground.
  useEffect(() => {
    if (!enableAutoFlush) return;
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void autoFlush();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enableAutoFlush, autoFlush]);

  // Opportunistic periodic catch-up while online.
  useEffect(() => {
    if (!enableAutoFlush) return;
    const timer = setInterval(() => void autoFlush(), PERIODIC_MS);
    return () => clearInterval(timer);
  }, [enableAutoFlush, autoFlush]);

  return { state, flush, online };
}
