import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  useAllApplicationRecords,
  useAllApplicators,
  useAllFarms,
  useAllFields,
  useAllOrganizations,
  useAllProducts,
} from "./db/queries";
import { DraftApplicationRecordForm } from "./ui/application-record/DraftApplicationRecordForm";
import { DraftsList } from "./ui/application-record/DraftsList";
import { ReviewQueue } from "./ui/application-record/ReviewQueue";
import { ContractorManager } from "./ui/contractor/ContractorManager";
import { FarmManager } from "./ui/farm/FarmManager";
import { OfflineBadge } from "./ui/system/OfflineBadge";
import {
  SessionProvider,
  useSessionRole,
} from "./ui/session/SessionContext";
import { RoleToggle } from "./ui/session/RoleToggle";
import { DEMO_ORG_ID } from "./db/seed";
import { SyncControls } from "./ui/system/SyncControls";

function AppShell() {
  const role = useSessionRole();
  const organizations = useAllOrganizations();
  const farms = useAllFarms();
  const fields = useAllFields();
  const applicators = useAllApplicators();
  const products = useAllProducts();
  const applicationRecords = useAllApplicationRecords();

  return (
    <Container component="main" maxWidth="md" sx={{ py: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              FieldLog
            </Typography>
            <RoleToggle />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <OfflineBadge />
            <SyncControls />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Offline-first pesticide application recordkeeping. Switch the demo
            role to see the contractor or manager view.
          </Typography>
        </Box>

        {role === "contractor" && (
          <>
            <Box data-testid="contractor-view">
              <Typography variant="h6" component="h2" gutterBottom>
                New application record (draft)
              </Typography>
              <DraftApplicationRecordForm />
            </Box>

            <Box>
              <Typography variant="h6" component="h2" gutterBottom>
                Records ({applicationRecords.length})
              </Typography>
              <DraftsList />
            </Box>
          </>
        )}

        {role === "manager" && (
          <Box data-testid="manager-view">
            <Typography variant="h6" component="h2" gutterBottom>
              Review queue
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Submitted records waiting on manager review or correction.
            </Typography>
            <ReviewQueue />

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" component="h2" gutterBottom>
              Manage farms
            </Typography>
            <FarmManager organizationId={DEMO_ORG_ID} />

            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" component="h2" gutterBottom>
                Manage contractors
              </Typography>
              <ContractorManager organizationId={DEMO_ORG_ID} />
            </Box>
          </Box>
        )}

        <Divider />

        <Box>
          <Typography variant="h6" component="h2" color="text.primary">
            Seed debug
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Read-only view of seeded reference data. Confirms IndexedDB
            persistence and Dexie reactivity.
          </Typography>

          <Typography variant="subtitle2" component="h3" sx={{ mt: 1 }}>
            Organizations ({organizations.length})
          </Typography>
          <List dense disablePadding>
            {organizations.map((o) => (
              <ListItem key={o.id} disableGutters disablePadding>
                <ListItemText
                  primary={o.name}
                  secondary={o.id}
                  slotProps={{
                    primary: { color: "text.primary" },
                    secondary: { color: "text.secondary" },
                  }}
                />
              </ListItem>
            ))}
          </List>

          <Typography variant="subtitle2" component="h3" sx={{ mt: 1 }}>
            Farms ({farms.length})
          </Typography>
          <List dense disablePadding>
            {farms.map((f) => (
              <ListItem key={f.id} disableGutters disablePadding>
                <ListItemText primary={f.name} />
              </ListItem>
            ))}
          </List>

          <Typography variant="subtitle2" component="h3" sx={{ mt: 1 }}>
            Fields ({fields.length})
          </Typography>
          <List dense disablePadding>
            {fields.map((f) => (
              <ListItem key={f.id} disableGutters disablePadding>
                <ListItemText
                  primary={
                    f.name +
                    (f.defaultCropOrSite ? ` — ${f.defaultCropOrSite}` : "") +
                    (f.defaultAcres != null ? ` (${f.defaultAcres} ac)` : "")
                  }
                />
              </ListItem>
            ))}
          </List>

          <Typography variant="subtitle2" component="h3" sx={{ mt: 1 }}>
            Applicators ({applicators.length})
          </Typography>
          <List dense disablePadding>
            {applicators.map((a) => (
              <ListItem key={a.id} disableGutters disablePadding>
                <ListItemText
                  primary={`${a.applicatorName} — ${a.contractorCompanyName}`}
                  secondary={
                    a.certificationNumber
                      ? `cert #${a.certificationNumber}`
                      : undefined
                  }
                />
              </ListItem>
            ))}
          </List>

          <Typography variant="subtitle2" component="h3" sx={{ mt: 1 }}>
            Products ({products.length})
          </Typography>
          <List dense disablePadding>
            {products.map((p) => (
              <ListItem key={p.id} disableGutters disablePadding>
                <ListItemText
                  primary={`${p.name} — EPA ${p.epaRegistrationNumber}`}
                  secondary={`RUP: ${p.rupStatus}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Stack>
    </Container>
  );
}

function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

export default App;
