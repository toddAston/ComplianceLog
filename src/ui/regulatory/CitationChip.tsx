import {
  lookupCitation,
  type CitationDestination,
} from "../../lib/regulationCitations";

// Citation tag chip used wherever the compliance engine surfaces a rule
// source. When the citation maps to a page in the in-app regulation PDF,
// the chip becomes a clickable button that opens the parent's dialog at the
// matching page. Non-CSR citations (RSMo, FIFRA, FIELDLOG_*) render as
// plain non-clickable code spans with a tooltip explaining why.
export type CitationChipProps = {
  citationShort: string;
  // Called with the citation string when the chip is clicked and is
  // PDF-backed. Parent owns the dialog state.
  onOpen?: (citationShort: string) => void;
};

const baseStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "1px 6px",
  borderRadius: 4,
  backgroundColor: "rgba(0,0,0,0.06)",
  color: "#374151",
  whiteSpace: "nowrap",
};

const clickableStyle: React.CSSProperties = {
  ...baseStyle,
  cursor: "pointer",
  border: "1px solid rgba(0,0,0,0.12)",
  textDecoration: "underline",
  textDecorationStyle: "dotted",
  textUnderlineOffset: 2,
  backgroundColor: "rgba(37,99,235,0.08)",
  color: "#1e40af",
};

const nonClickableStyle: React.CSSProperties = {
  ...baseStyle,
  // Cue to the reader that the chip is informational only.
  border: "1px dashed rgba(0,0,0,0.18)",
};

function tooltipFor(
  citationShort: string,
  dest: CitationDestination | undefined
): string {
  if (!dest) return `Citation: ${citationShort}`;
  return `${dest.sectionTitle}`;
}

export function CitationChip({ citationShort, onOpen }: CitationChipProps) {
  const dest = lookupCitation(citationShort);
  const isClickable = !!dest && dest.kind === "pdf" && !!onOpen;

  if (isClickable) {
    return (
      <button
        type="button"
        title={tooltipFor(citationShort, dest)}
        onClick={(e) => {
          // Stop propagation so callers that put the chip inside a card with
          // its own row-click handler (e.g. DraftsList) don't both fire.
          e.stopPropagation();
          onOpen!(citationShort);
        }}
        data-testid={`citation-chip-${citationShort}`}
        data-citation-clickable="true"
        style={{
          ...clickableStyle,
          font: "inherit",
        }}
      >
        {citationShort}
      </button>
    );
  }

  return (
    <code
      title={tooltipFor(citationShort, dest)}
      data-testid={`citation-chip-${citationShort}`}
      data-citation-clickable="false"
      style={nonClickableStyle}
    >
      {citationShort}
    </code>
  );
}
