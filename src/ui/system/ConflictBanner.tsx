import { useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ApplicationRecord } from "../../domain/types";
import {
  adoptServerCopy,
  retryRecordSync,
} from "../../application/sync/syncService";

// Shown when a record's last sync failed. A conflict (server has a newer version,
// stashed in serverShadow) offers "Use server copy"; a plain rejection offers a retry.
// Server-wins by design — there is no silent merge of a stale offline edit.
export function ConflictBanner({ record }: { record: ApplicationRecord }) {
  const [busy, setBusy] = useState(false);
  if (record.syncStatus !== "sync_failed") return null;

  const hasServerCopy = record.serverShadow != null;

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert
      severity={hasServerCopy ? "warning" : "error"}
      variant="outlined"
      sx={{ mb: 2 }}
      data-testid="conflict-banner"
    >
      <AlertTitle sx={{ fontWeight: 700 }}>
        {hasServerCopy ? "Sync conflict" : "Sync failed"}
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }} data-testid="conflict-message">
        {record.syncError ??
          (hasServerCopy
            ? "The server has a newer version of this record."
            : "The server rejected the last change.")}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        {hasServerCopy && (
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={busy}
            onClick={run(() => adoptServerCopy(record.id))}
            data-testid="conflict-adopt-server"
          >
            Use server copy
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={run(() => retryRecordSync(record.id))}
          data-testid="conflict-retry"
        >
          Retry sync
        </Button>
      </Stack>
    </Alert>
  );
}
