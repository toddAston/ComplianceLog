import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSyncFlush } from "../../application/sync/useSyncFlush";
import type { SyncTransport } from "../../application/sync/transport";

// Manual "Sync now" affordance. By default this is purely click-driven —
// mounting the control does not trigger background flushes. Pass
// `autoFlush={true}` to also register the online/foreground/periodic auto-flush
// effects from `useSyncFlush`. The default is off because the global mount in
// `AppHeader` should not silently sync the loopback transport on every page
// load (which would flip records out of `local_only` before the operator
// clicked Sync, hurting both tests and the demo narrative).
export function SyncControls({
  transport,
  autoFlush = false,
}: {
  transport?: SyncTransport;
  autoFlush?: boolean;
}) {
  const { state, flush, online } = useSyncFlush(transport, {
    enableAutoFlush: autoFlush,
  });

  const summaryText = (): string | null => {
    if (state.kind !== "done") return null;
    const { processed, applied, conflicts, rejected, skipped } = state.summary;
    if (skipped) return "Sync already in progress.";
    if (processed === 0) return "Nothing to sync.";
    const parts = [`${applied} synced`];
    if (conflicts > 0) parts.push(`${conflicts} conflict${conflicts === 1 ? "" : "s"}`);
    if (rejected > 0) parts.push(`${rejected} rejected`);
    return parts.join(", ") + ".";
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", flexWrap: "wrap" }}
    >
      <Button
        size="small"
        variant="outlined"
        onClick={() => void flush()}
        disabled={state.kind === "running" || !online}
        data-testid="sync-now-button"
      >
        {state.kind === "running" ? "Syncing…" : "Sync now"}
      </Button>
      {!online && (
        <Typography variant="caption" color="text.secondary">
          Offline — will sync on reconnect.
        </Typography>
      )}
      {state.kind === "done" && summaryText() && (
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid="sync-result"
        >
          {summaryText()}
        </Typography>
      )}
      {state.kind === "error" && (
        <Typography variant="caption" color="error" data-testid="sync-error">
          {state.message}
        </Typography>
      )}
    </Stack>
  );
}
