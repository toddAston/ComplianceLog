import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { createField, renameField } from "../../application/fieldService";
import { useAllFields } from "../../db/queries";

export type FieldsForFarmProps = {
  organizationId: string;
  farmId: string;
};

export function FieldsForFarm({ organizationId, farmId }: FieldsForFarmProps) {
  const allFields = useAllFields();
  const fields = allFields
    .filter((f) => f.farmId === farmId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const [name, setName] = useState("");
  const [acres, setAcres] = useState("");
  const [crop, setCrop] = useState("");
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
      const parsedAcres = acres.trim() ? Number(acres) : undefined;
      if (parsedAcres != null && Number.isNaN(parsedAcres)) {
        throw new Error("Acres must be a number.");
      }
      await createField({
        organizationId,
        farmId,
        name,
        defaultAcres: parsedAcres,
        defaultCropOrSite: crop,
      });
      setName("");
      setAcres("");
      setCrop("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setCreating(false);
    }
  };

  const submitRename = async (id: string) => {
    setRenameError(null);
    try {
      await renameField(id, renameDraft);
      setRenameTargetId(null);
      setRenameDraft("");
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Unknown error.");
    }
  };

  return (
    <Box data-testid={`fields-for-farm-${farmId}`}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "baseline", mb: 1 }}
      >
        <Typography variant="subtitle2" component="h4">
          Fields
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ({fields.length})
        </Typography>
      </Stack>

      {fields.length === 0 ? (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ mb: 1.5, py: 0.5 }}
          data-testid={`fields-empty-${farmId}`}
        >
          No fields yet.
        </Alert>
      ) : (
        <Stack
          spacing={0.75}
          sx={{ mb: 1.5 }}
          data-testid={`field-list-${farmId}`}
        >
          {fields.map((f) => (
            <Box
              key={f.id}
              data-testid={`field-row-${f.id}`}
              sx={{
                px: 1,
                py: 0.75,
                borderRadius: 1,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                "&:hover": { borderColor: "text.secondary" },
              }}
            >
              {renameTargetId === f.id ? (
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <TextField
                    size="small"
                    label="Edit field name"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    error={!!renameError}
                    helperText={renameError ?? undefined}
                    slotProps={{
                      htmlInput: { "aria-label": `Edit ${f.name}` },
                    }}
                    sx={{ flex: "1 1 180px" }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => submitRename(f.id)}
                    disabled={renameDraft.trim().length === 0}
                  >
                    Save
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setRenameTargetId(null);
                      setRenameError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </Stack>
              ) : (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", gap: 1 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.name}
                    </Typography>
                    {(f.defaultCropOrSite || f.defaultAcres != null) && (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ mt: 0.5, flexWrap: "wrap" }}
                      >
                        {f.defaultCropOrSite && (
                          <Chip
                            size="small"
                            label={f.defaultCropOrSite}
                            variant="outlined"
                          />
                        )}
                        {f.defaultAcres != null && (
                          <Chip
                            size="small"
                            label={`${f.defaultAcres} ac`}
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    )}
                  </Box>
                  <Button
                    size="small"
                    onClick={() => {
                      setRenameTargetId(f.id);
                      setRenameDraft(f.name);
                      setRenameError(null);
                    }}
                    sx={{ flexShrink: 0 }}
                  >
                    Edit
                  </Button>
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <Box
        component="form"
        onSubmit={onCreate}
        sx={{
          p: 1,
          borderRadius: 1,
          border: "1px dashed",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.75 }}
        >
          Add a field
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <TextField
            size="small"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!createError}
            helperText={createError ?? undefined}
            slotProps={{
              htmlInput: { "aria-label": `New field name for farm ${farmId}` },
            }}
            sx={{ flex: "1 1 140px" }}
          />
          <TextField
            size="small"
            label="Acres"
            value={acres}
            onChange={(e) => setAcres(e.target.value)}
            slotProps={{
              htmlInput: {
                inputMode: "decimal",
                "aria-label": `Acres for new field on farm ${farmId}`,
              },
            }}
            sx={{ flex: "0 1 90px" }}
          />
          <TextField
            size="small"
            label="Crop"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            slotProps={{
              htmlInput: {
                "aria-label": `Crop for new field on farm ${farmId}`,
              },
            }}
            sx={{ flex: "1 1 120px" }}
          />
          <IconButton
            type="submit"
            size="small"
            color="primary"
            aria-label="Add field"
            disabled={creating || name.trim().length === 0}
            sx={{ border: 1, borderColor: "divider", alignSelf: "center" }}
          >
            {creating ? <CircularProgress size={18} /> : <AddIcon />}
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}
