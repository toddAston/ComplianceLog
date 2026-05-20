import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import type { SyncStatus } from "../../domain/types";

type ChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";

const labels: Record<SyncStatus, string> = {
  local_only: "Local only",
  queued: "Queued",
  syncing: "Syncing…",
  synced: "Synced",
  sync_failed: "Sync failed",
};

const tooltips: Record<SyncStatus, string> = {
  local_only:
    "Not queued for sync yet. Record exists only in this device's IndexedDB.",
  queued: "Queued for sync. Will upload when the device reconnects.",
  syncing: "Uploading to the server now.",
  synced: "Confirmed received by the server.",
  sync_failed:
    "Server rejected the last sync attempt. Will retry automatically.",
};

const colors: Record<SyncStatus, ChipColor> = {
  local_only: "default",
  queued: "info",
  syncing: "info",
  synced: "success",
  sync_failed: "error",
};

export function SyncStatusChip({
  status,
  recordId,
}: {
  status: SyncStatus;
  recordId?: string;
}) {
  return (
    <Tooltip title={tooltips[status]}>
      <Chip
        size="small"
        variant={status === "synced" ? "filled" : "outlined"}
        color={colors[status]}
        label={labels[status]}
        data-testid={
          recordId ? `sync-chip-${recordId}` : `sync-chip-${status}`
        }
      />
    </Tooltip>
  );
}
