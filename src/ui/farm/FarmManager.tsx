import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createFarm, renameFarm } from "../../application/farmService";
import { useAllFarms } from "../../db/queries";

export type FarmManagerProps = {
  organizationId: string;
};

export function FarmManager({ organizationId }: FarmManagerProps) {
  const farms = useAllFarms();
  const myFarms = farms.filter((f) => f.organizationId === organizationId);

  const [draftName, setDraftName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createFarm({ organizationId, name: draftName });
      setDraftName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setCreating(false);
    }
  };

  const beginRename = (id: string, currentName: string) => {
    setRenameTargetId(id);
    setRenameDraft(currentName);
    setRenameError(null);
  };

  const cancelRename = () => {
    setRenameTargetId(null);
    setRenameDraft("");
    setRenameError(null);
  };

  const submitRename = async (id: string) => {
    setRenameError(null);
    try {
      await renameFarm(id, renameDraft);
      cancelRename();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Unknown error.");
    }
  };

  return (
    <Stack spacing={2} data-testid="farm-manager">
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" component="h3" sx={{ mb: 1.5 }}>
            New farm
          </Typography>
          <Box component="form" onSubmit={onCreate}>
            <Stack spacing={1.5}>
              <TextField
                label="Farm name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                error={!!createError}
                helperText={createError ?? undefined}
                slotProps={{ htmlInput: { "aria-label": "Farm name" } }}
              />
              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={creating || draftName.trim().length === 0}
                >
                  {creating ? "Creating…" : "Create farm"}
                </Button>
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" component="h3" sx={{ mb: 1 }}>
            Farms ({myFarms.length})
          </Typography>
          {myFarms.length === 0 ? (
            <Alert severity="info" data-testid="farm-list-empty">
              No farms yet. Add one above.
            </Alert>
          ) : (
            <Stack spacing={1} data-testid="farm-list">
              {myFarms.map((f) => (
                <Card key={f.id} variant="outlined" data-testid={`farm-row-${f.id}`}>
                  <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                    {renameTargetId === f.id ? (
                      <Stack spacing={1}>
                        <TextField
                          label="Rename farm"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          error={!!renameError}
                          helperText={renameError ?? undefined}
                          slotProps={{
                            htmlInput: { "aria-label": `Rename ${f.name}` },
                          }}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => submitRename(f.id)}
                            disabled={renameDraft.trim().length === 0}
                          >
                            Save
                          </Button>
                          <Button size="small" onClick={cancelRename}>
                            Cancel
                          </Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box>
                          <Typography variant="body1">{f.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            id: {f.id}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => beginRename(f.id, f.name)}
                        >
                          Rename
                        </Button>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
