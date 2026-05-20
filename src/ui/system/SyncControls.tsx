import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSyncFlush } from "../../application/sync/useSyncFlush";
import type { SyncTransport } from "../../application/sync/transport";

// Mounts the single app-wide flush controller (online/foreground/periodic triggers via
// useSyncFlush) and exposes a manual "Sync now" button. Capture/submit are never gated
// here; only the flush is. `transport` is injectable for tests.
export function SyncControls({ transport }: { transport?: SyncTransport }) {
  const { state, flush, online } = useSyncFlush(transport);

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
