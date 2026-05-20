import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { createFarm, renameFarm } from "../../application/farmService";
import { useAllFarms } from "../../db/queries";
import { FieldsForFarm } from "./FieldsForFarm";

export type FarmManagerProps = {
  organizationId: string;
};

export function FarmManager({ organizationId }: FarmManagerProps) {
  const farms = useAllFarms();
  const myFarms = farms
    .filter((f) => f.organizationId === organizationId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

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
          <Box component="form" onSubmit={onCreate}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "flex-start" }}
            >
              <TextField
                label="New farm name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                error={!!createError}
                helperText={createError ?? undefined}
                slotProps={{ htmlInput: { "aria-label": "Farm name" } }}
                sx={{ flex: 1 }}
              />
              <IconButton
                type="submit"
                color="primary"
                aria-label="Create farm"
                disabled={creating || draftName.trim().length === 0}
                sx={{ mt: 1, border: 1, borderColor: "divider" }}
              >
                {creating ? <CircularProgress size={20} /> : <AddIcon />}
              </IconButton>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "baseline", mb: 1.5 }}
          >
            <Typography variant="subtitle1" component="h3">
              Farms
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ({myFarms.length})
            </Typography>
          </Stack>

          {myFarms.length === 0 ? (
            <Alert severity="info" data-testid="farm-list-empty">
              No farms yet. Add one above.
            </Alert>
          ) : (
            <Stack spacing={1.5} data-testid="farm-list">
              {myFarms.map((f) => {
                const isRenaming = renameTargetId === f.id;
                return (
                  <Card
                    key={f.id}
                    variant="outlined"
                    data-testid={`farm-row-${f.id}`}
                    sx={{
                      bgcolor: "background.default",
                      borderColor: isRenaming ? "primary.main" : "divider",
                    }}
                  >
                    <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                      {isRenaming ? (
                        <Stack spacing={1}>
                          <TextField
                            label="Edit farm name"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            error={!!renameError}
                            helperText={renameError ?? undefined}
                            slotProps={{
                              htmlInput: { "aria-label": `Edit ${f.name}` },
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
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="h6"
                            component="div"
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                            }}
                          >
                            {f.name}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => beginRename(f.id, f.name)}
                            sx={{ flexShrink: 0 }}
                          >
                            Edit
                          </Button>
                        </Stack>
                      )}
                      <Divider sx={{ my: 1.5 }} />
                      <FieldsForFarm
                        organizationId={organizationId}
                        farmId={f.id}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
