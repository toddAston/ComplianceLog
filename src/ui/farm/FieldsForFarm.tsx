import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { createField, updateField } from "../../application/fieldService";
import { useAllFields } from "../../db/queries";
import type { FieldSite } from "../../domain/types";

export type FieldsForFarmProps = {
  organizationId: string;
  farmId: string;
  onEditingChange?: (editing: boolean) => void;
};

export function FieldsForFarm({
  organizationId,
  farmId,
  onEditingChange,
}: FieldsForFarmProps) {
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

  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAcres, setEditAcres] = useState("");
  const [editCrop, setEditCrop] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const beginEdit = (f: FieldSite) => {
    setEditTargetId(f.id);
    setEditName(f.name);
    setEditAcres(f.defaultAcres != null ? String(f.defaultAcres) : "");
    setEditCrop(f.defaultCropOrSite ?? "");
    setEditError(null);
    onEditingChange?.(true);
  };

  const cancelEdit = () => {
    setEditTargetId(null);
    setEditName("");
    setEditAcres("");
    setEditCrop("");
    setEditError(null);
    onEditingChange?.(false);
  };

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

  const submitEdit = async (id: string) => {
    setEditError(null);
    try {
      const trimmedAcres = editAcres.trim();
      let acresPatch: number | null;
      if (trimmedAcres === "") {
        acresPatch = null;
      } else {
        const parsed = Number(trimmedAcres);
        if (Number.isNaN(parsed)) {
          throw new Error("Acres must be a number.");
        }
        acresPatch = parsed;
      }
      await updateField(id, {
        name: editName,
        defaultAcres: acresPatch,
        defaultCropOrSite: editCrop.trim() === "" ? null : editCrop,
      });
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unknown error.");
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

      {fields.length > 0 && (
        <TextField
          select
          size="small"
          label="Pick a field to edit"
          value={editTargetId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              cancelEdit();
              return;
            }
            const target = fields.find((field) => field.id === id);
            if (target) beginEdit(target);
          }}
          slotProps={{
            htmlInput: {
              "aria-label": `Pick a field to edit on farm ${farmId}`,
            },
          }}
          sx={{ mb: 1.5 }}
          fullWidth
          data-testid={`field-picker-${farmId}`}
        >
          <MenuItem value="">— select —</MenuItem>
          {fields.map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {f.name}
            </MenuItem>
          ))}
        </TextField>
      )}

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
              {editTargetId === f.id ? (
                <Stack spacing={1}>
                  <TextField
                    size="small"
                    label="Edit field name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    error={!!editError}
                    slotProps={{
                      htmlInput: { "aria-label": `Edit ${f.name}` },
                    }}
                    fullWidth
                  />
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <TextField
                      size="small"
                      label="Acres"
                      value={editAcres}
                      onChange={(e) => setEditAcres(e.target.value)}
                      slotProps={{
                        htmlInput: {
                          inputMode: "decimal",
                          "aria-label": `Edit acres for ${f.name}`,
                        },
                      }}
                      sx={{ flex: "0 1 110px" }}
                    />
                    <TextField
                      size="small"
                      label="Crop"
                      value={editCrop}
                      onChange={(e) => setEditCrop(e.target.value)}
                      slotProps={{
                        htmlInput: {
                          "aria-label": `Edit crop for ${f.name}`,
                        },
                      }}
                      sx={{ flex: "1 1 140px" }}
                    />
                  </Stack>
                  {editError && (
                    <Typography variant="caption" color="error">
                      {editError}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => submitEdit(f.id)}
                      disabled={editName.trim().length === 0}
                    >
                      Save
                    </Button>
                    <Button size="small" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </Stack>
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
                    onClick={() => beginEdit(f)}
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
