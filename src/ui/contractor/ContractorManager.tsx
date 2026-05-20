import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  inviteContractor,
  type InviteResult,
} from "../../application/contractorService";
import { useAllApplicators } from "../../db/queries";

export type ContractorManagerProps = {
  organizationId: string;
};

type InviteState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; result: InviteResult }
  | { kind: "error"; message: string };

export function ContractorManager({ organizationId }: ContractorManagerProps) {
  const applicators = useAllApplicators();
  const mine = applicators.filter((a) => a.organizationId === organizationId);

  const [applicatorName, setApplicatorName] = useState("");
  const [company, setCompany] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [state, setState] = useState<InviteState>({ kind: "idle" });

  const reset = () => {
    setApplicatorName("");
    setCompany("");
    setCertNumber("");
  };

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "submitting" });
    try {
      const result = await inviteContractor({
        organizationId,
        applicatorName,
        contractorCompanyName: company,
        certificationNumber: certNumber,
      });
      setState({ kind: "sent", result });
      reset();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  const formInvalid =
    applicatorName.trim().length === 0 || company.trim().length === 0;

  return (
    <Stack spacing={2} data-testid="contractor-manager">
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" component="h3" sx={{ mb: 1.5 }}>
            Invite contractor
          </Typography>
          <Box component="form" onSubmit={onInvite}>
            <Stack spacing={1.5}>
              <TextField
                label="Applicator name"
                value={applicatorName}
                onChange={(e) => setApplicatorName(e.target.value)}
                slotProps={{
                  htmlInput: { "aria-label": "Applicator name" },
                }}
              />
              <TextField
                label="Contractor company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                slotProps={{
                  htmlInput: { "aria-label": "Contractor company" },
                }}
              />
              <TextField
                label="Certification # (optional)"
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                slotProps={{
                  htmlInput: { "aria-label": "Certification number" },
                }}
              />
              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={state.kind === "submitting" || formInvalid}
                >
                  {state.kind === "submitting" ? "Sending…" : "Send invite"}
                </Button>
              </Box>
              {state.kind === "error" && (
                <Alert severity="error" data-testid="invite-error">
                  {state.message}
                </Alert>
              )}
              {state.kind === "sent" && (
                <Alert severity="success" data-testid="invite-success">
                  Invite stub created for{" "}
                  <strong>{state.result.applicator.applicatorName}</strong>.
                  Share this link manually for v0.1:{" "}
                  <code data-testid="invite-link">
                    {state.result.inviteLink}
                  </code>
                </Alert>
              )}
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" component="h3" sx={{ mb: 1 }}>
            Contractors ({mine.length})
          </Typography>
          {mine.length === 0 ? (
            <Alert severity="info" data-testid="contractor-list-empty">
              No contractors invited yet.
            </Alert>
          ) : (
            <Stack spacing={1} data-testid="contractor-list">
              {mine.map((a) => (
                <Card
                  key={a.id}
                  variant="outlined"
                  data-testid={`contractor-row-${a.id}`}
                >
                  <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                    <Typography variant="body1">
                      {a.applicatorName} — {a.contractorCompanyName}
                    </Typography>
                    {a.certificationNumber && (
                      <Typography variant="caption" color="text.secondary">
                        cert # {a.certificationNumber}
                      </Typography>
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
