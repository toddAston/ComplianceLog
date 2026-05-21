import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  buildPdfHref,
  lookupCitation,
  REGULATION_PDF_PATH,
  type CitationDestination,
} from "../../lib/regulationCitations";

export type RegulationDialogProps = {
  // The `citationShort` to open the dialog at — same string the compliance
  // engine emits (e.g. "2 CSR 70-25.120(D)"). When null the dialog is closed.
  citationShort: string | null;
  onClose: () => void;
};

// Modal that surfaces the compiled Missouri 2 CSR 70-25 PDF jumped to the
// regulatory page that backs a compliance citation. Native iframe with
// browser PDF viewer — no PDF.js bundle bloat. Cross-browser `#page=N`
// fragment is honored consistently; we intentionally do NOT use `#search=`
// because that's Chrome/Edge-only (Firefox ignores it).
//
// Non-CSR citations (RSMo statutes, FIFRA, FIELDLOG_*) open the dialog too
// but render an explanatory message instead of the PDF — the chip should
// arguably be non-clickable for those, and CitationChip does suppress the
// click. This branch is the defensive fallback if a caller passes one
// anyway.
export function RegulationDialog({
  citationShort,
  onClose,
}: RegulationDialogProps) {
  if (!citationShort) return null;
  const dest = lookupCitation(citationShort);

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      aria-labelledby="regulation-dialog-title"
      data-testid="regulation-dialog"
    >
      <DialogTitle id="regulation-dialog-title" sx={{ pb: 1 }}>
        <Typography variant="overline" sx={{ display: "block", lineHeight: 1 }}>
          Citation
        </Typography>
        <Box
          component="code"
          sx={{ fontSize: 16, fontWeight: 600, color: "var(--color-primary)" }}
        >
          {citationShort}
        </Box>
        {dest && (
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            {dest.sectionTitle}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          p: 0,
          height: "78vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {dest && dest.kind === "pdf" ? (
          <PdfFrame citation={dest} />
        ) : (
          <NonPdfNotice
            citationShort={citationShort}
            destination={dest ?? null}
          />
        )}
      </DialogContent>

      <DialogActions
        sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}
      >
        <Box sx={{ display: "flex", gap: 1 }}>
          {dest && dest.kind === "pdf" && (
            <Button
              size="small"
              variant="outlined"
              component="a"
              href={buildPdfHref(dest) ?? REGULATION_PDF_PATH}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="regulation-dialog-open-tab"
            >
              Open in new tab
            </Button>
          )}
        </Box>
        <Button onClick={onClose} data-testid="regulation-dialog-close">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PdfFrame({ citation }: { citation: CitationDestination }) {
  const href = buildPdfHref(citation) ?? REGULATION_PDF_PATH;
  return (
    <Box sx={{ flex: 1, display: "flex" }}>
      <iframe
        src={href}
        title={`Regulation PDF — ${citation.sectionTitle}`}
        data-testid="regulation-pdf-frame"
        style={{
          border: "none",
          width: "100%",
          height: "100%",
        }}
      />
    </Box>
  );
}

function NonPdfNotice({
  citationShort,
  destination,
}: {
  citationShort: string;
  destination: CitationDestination | null;
}) {
  const headline = !destination
    ? "Unknown citation"
    : destination.kind === "external"
      ? "External statute reference"
      : "Internal FieldLog tag";
  const body = !destination
    ? `The citation tag "${citationShort}" is not registered in the regulation lookup. The compliance engine emitted it from a rule that needs its source tag added to lib/regulationCitations.ts.`
    : destination.kind === "external"
      ? `This citation points to a Missouri Revised Statute, not a Code of State Regulations section, and is not part of the compiled PDF. Look it up in the Missouri Revised Statutes.`
      : `This is an internal FieldLog source tag used for cross-cutting checks (chain-of-custody, operational evidence quality, FIFRA labeling). There's no single statutory section to link to.`;

  return (
    <Box
      data-testid="regulation-dialog-non-pdf"
      sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}
    >
      <Typography variant="h6">{headline}</Typography>
      <Typography variant="body2" color="text.secondary">
        {destination?.sectionTitle ?? citationShort}
      </Typography>
      <Typography variant="body2">{body}</Typography>
    </Box>
  );
}
