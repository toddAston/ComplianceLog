import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSession, type SessionRole } from "./SessionContext";

export function RoleToggle() {
  const { role, setRole } = useSession();

  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    next: SessionRole | null
  ) => {
    if (next) setRole(next);
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center" }}
      data-testid="role-toggle"
    >
      <Typography variant="caption" color="text.secondary">
        Demo role
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={role}
        onChange={handleChange}
        aria-label="Demo role"
      >
        <ToggleButton value="contractor" aria-label="Contractor view">
          Contractor
        </ToggleButton>
        <ToggleButton value="manager" aria-label="Manager view">
          Manager
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}
