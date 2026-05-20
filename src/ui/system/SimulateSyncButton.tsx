import { useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { simulateSyncAllQueued } from "../../application/applicationRecordService";
import { useSessionActor } from "../session/SessionContext";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; count: number }
  | { kind: "error"; message: string };

export function SimulateSyncButton() {
  const actor = useSessionActor();
  const [state, setState] = useState<State>({ kind: "idle" });

  if (!import.meta.env.DEV) return null;

  const onClick = async () => {
    setState({ kind: "running" });
    try {
      const { syncedRecordIds } = await simulateSyncAllQueued(actor);
      setState({ kind: "done", count: syncedRecordIds.length });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
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
        onClick={onClick}
        disabled={state.kind === "running"}
        data-testid="simulate-sync-button"
      >
        {state.kind === "running" ? "Syncing…" : "Simulate sync"}
      </Button>
      {state.kind === "done" && (
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid="simulate-sync-result"
        >
          {state.count === 0
            ? "Nothing queued."
            : `Synced ${state.count} record${state.count === 1 ? "" : "s"}.`}
        </Typography>
      )}
      {state.kind === "error" && (
        <Typography variant="caption" color="error">
          {state.message}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        (debug — pre-launch only)
      </Typography>
    </Stack>
  );
}
