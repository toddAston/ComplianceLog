import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  inviteContractor,
  type InviteResult,
} from "../../application/contractorService";
import { useAllApplicators } from "../../db/queries";
import type { Applicator } from "../../domain/types";
import { ContractorDetailDialog } from "./ContractorDetailDialog";

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

  // Detail-dialog state: which applicator is being edited (null = closed).
  const [editingApplicator, setEditingApplicator] = useState<Applicator | null>(
    null
  );

  // Collapsed company groups. Default = open (empty set means everyone open);
  // a company id appears in the set when its header has been clicked to
  // collapse the body. Persists across re-renders but not across reloads —
  // intentional, the manager will commonly want every group open by default.
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(
    new Set()
  );
  const toggleCompany = (key: string) =>
    setCollapsedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
            <Stack spacing={2} data-testid="contractor-list">
              {groupByCompany(mine).map(({ company, applicators }) => {
                const slug = slugify(company);
                const isCollapsed = collapsedCompanies.has(slug);
                return (
                  <Box
                    key={company}
                    data-testid={`contractor-company-${slug}`}
                  >
                    <IconButton
                      onClick={() => toggleCompany(slug)}
                      aria-expanded={!isCollapsed}
                      aria-controls={`contractor-company-body-${slug}`}
                      data-testid={`contractor-company-toggle-${slug}`}
                      sx={{
                        width: "100%",
                        borderRadius: 1,
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        px: 1,
                        py: 0.5,
                        mb: 0.5,
                        fontSize: "inherit",
                        color: "inherit",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 1,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <Box
                          component="span"
                          aria-hidden="true"
                          sx={{
                            fontSize: 14,
                            transition: "transform 150ms ease-in-out",
                            transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                            display: "inline-block",
                            width: 14,
                          }}
                        >
                          ▾
                        </Box>
                        <Typography
                          variant="subtitle2"
                          component="h4"
                          sx={{
                            fontWeight: 700,
                            textAlign: "left",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {company}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {applicators.length}{" "}
                        {applicators.length === 1 ? "applicator" : "applicators"}
                      </Typography>
                    </IconButton>
                    {!isCollapsed && (
                      <Stack
                        spacing={1}
                        id={`contractor-company-body-${slug}`}
                      >
                        {applicators.map((a) => (
                          <Card
                            key={a.id}
                            variant="outlined"
                            data-testid={`contractor-row-${a.id}`}
                          >
                            <CardActionArea
                              onClick={() => setEditingApplicator(a)}
                              data-testid={`contractor-row-button-${a.id}`}
                              aria-label={`Edit ${a.applicatorName}`}
                            >
                              <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                                <Typography variant="body1">
                                  {a.applicatorName}
                                </Typography>
                                {a.certificationNumber ? (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    cert # {a.certificationNumber}
                                  </Typography>
                                ) : (
                                  <Typography
                                    variant="caption"
                                    color="warning.main"
                                    data-testid={`contractor-uncertified-${a.id}`}
                                  >
                                    uncertified
                                  </Typography>
                                )}
                              </CardContent>
                            </CardActionArea>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      <ContractorDetailDialog
        applicator={editingApplicator}
        onClose={() => setEditingApplicator(null)}
      />
    </Stack>
  );
}

// Groups applicators by their contractorCompanyName and sorts companies
// alphabetically. Applicators inside each group are sorted by name so the
// list reads predictably across reseeds.
function groupByCompany(
  applicators: Applicator[]
): Array<{ company: string; applicators: Applicator[] }> {
  const bucketByCompany = new Map<string, Applicator[]>();
  for (const a of applicators) {
    const key = a.contractorCompanyName?.trim() || "(no company)";
    const list = bucketByCompany.get(key) ?? [];
    list.push(a);
    bucketByCompany.set(key, list);
  }
  return Array.from(bucketByCompany.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([company, list]) => ({
      company,
      applicators: list
        .slice()
        .sort((x, y) => x.applicatorName.localeCompare(y.applicatorName)),
    }));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
