import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createField, renameField } from "../../application/fieldService";
import { useAllFields } from "../../db/queries";

export type FieldsForFarmProps = {
  organizationId: string;
  farmId: string;
};

export function FieldsForFarm({ organizationId, farmId }: FieldsForFarmProps) {
  const allFields = useAllFields();
  const fields = allFields.filter((f) => f.farmId === farmId);

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
    <Box
      data-testid={`fields-for-farm-${farmId}`}
      sx={{ mt: 1, pl: 1, borderLeft: "2px solid", borderColor: "divider" }}
    >
      <Typography variant="caption" color="text.secondary">
        Fields ({fields.length})
      </Typography>
      {fields.length === 0 ? (
        <Alert
          severity="info"
          sx={{ mt: 0.5, mb: 1 }}
          data-testid={`fields-empty-${farmId}`}
        >
          No fields yet.
        </Alert>
      ) : (
        <Stack
          spacing={0.5}
          sx={{ mt: 0.5, mb: 1 }}
          data-testid={`field-list-${farmId}`}
        >
          {fields.map((f) => (
            <Box
              key={f.id}
              data-testid={`field-row-${f.id}`}
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              {renameTargetId === f.id ? (
                <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
                  <TextField
                    size="small"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    error={!!renameError}
                    helperText={renameError ?? undefined}
                    slotProps={{
                      htmlInput: { "aria-label": `Rename ${f.name}` },
                    }}
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
                <>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {f.name}
                    {f.defaultCropOrSite ? ` — ${f.defaultCropOrSite}` : ""}
                    {f.defaultAcres != null ? ` (${f.defaultAcres} ac)` : ""}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => {
                      setRenameTargetId(f.id);
                      setRenameDraft(f.name);
                      setRenameError(null);
                    }}
                  >
                    Rename
                  </Button>
                </>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <Box component="form" onSubmit={onCreate}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <TextField
            size="small"
            label="New field name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!createError}
            helperText={createError ?? undefined}
            slotProps={{
              htmlInput: { "aria-label": `New field name for farm ${farmId}` },
            }}
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
          />
          <Button
            type="submit"
            size="small"
            variant="contained"
            disabled={creating || name.trim().length === 0}
          >
            {creating ? "Adding…" : "Add field"}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
