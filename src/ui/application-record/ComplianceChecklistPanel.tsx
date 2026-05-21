import type {
  ComplianceCheckOutcome,
  ComplianceResultCode,
} from "../../application/complianceRules";

// Display-side mapping for the matrix's result codes. Order matters — the panel
// renders sections in this order, with the most severe at the top.
const BUCKET_ORDER: ComplianceResultCode[] = [
  "BLOCKED_BY_EXPLICIT_RULE",
  "MISSING_REQUIRED_FIELD",
  "WARNING",
  "NEEDS_REVIEW",
  "LABEL_VERIFICATION_REQUIRED",
];

type BucketStyle = {
  label: string;
  icon: string;
  fg: string;
  bg: string;
  border: string;
};

const BUCKET_STYLES: Record<ComplianceResultCode, BucketStyle> = {
  BLOCKED_BY_EXPLICIT_RULE: {
    label: "Blocking",
    icon: "✗",
    fg: "#7f1d1d",
    bg: "rgba(127,29,29,0.1)",
    border: "rgba(127,29,29,0.35)",
  },
  MISSING_REQUIRED_FIELD: {
    label: "Missing required field",
    icon: "✗",
    fg: "#991b1b",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.35)",
  },
  WARNING: {
    label: "Warning",
    icon: "⚠",
    fg: "#92400e",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.35)",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    icon: "?",
    fg: "#1e40af",
    bg: "rgba(37,99,235,0.1)",
    border: "rgba(37,99,235,0.35)",
  },
  LABEL_VERIFICATION_REQUIRED: {
    label: "Label verification required",
    icon: "📄",
    fg: "#5b21b6",
    bg: "rgba(124,58,237,0.1)",
    border: "rgba(124,58,237,0.35)",
  },
  OK: {
    label: "OK",
    icon: "✓",
    fg: "#166534",
    bg: "rgba(22,101,52,0.1)",
    border: "rgba(22,101,52,0.35)",
  },
  SOURCE_UNAVAILABLE: {
    label: "Source unavailable",
    icon: "?",
    fg: "#1f2937",
    bg: "rgba(31,41,55,0.1)",
    border: "rgba(31,41,55,0.35)",
  },
};

// A check belongs in a bucket when it's either a hard `fail`, or an `unknown`
// for the review-required result codes (label-verification + needs-review). The
// matrix says label items must never auto-pass — `unknown` is the engine's way
// of saying "review pending" and we want those visible in the panel.
function isSurfaced(o: ComplianceCheckOutcome): boolean {
  if (o.status === "fail") return true;
  if (o.status === "unknown") {
    return (
      o.resultCode === "NEEDS_REVIEW" ||
      o.resultCode === "LABEL_VERIFICATION_REQUIRED"
    );
  }
  return false;
}

const Badge = ({ style, count }: { style: BucketStyle; count: number }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: 12,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 999,
      backgroundColor: style.bg,
      color: style.fg,
      border: `1px solid ${style.border}`,
    }}
  >
    {style.icon} {count} {style.label}
  </span>
);

const Citation = ({ text }: { text: string }) => (
  <code
    style={{
      fontSize: 11,
      padding: "1px 6px",
      borderRadius: 4,
      backgroundColor: "rgba(0,0,0,0.06)",
      color: "#374151",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </code>
);

export type ComplianceChecklistPanelProps = {
  outcomes: ComplianceCheckOutcome[];
  missingFormFields?: string[];
  title?: string;
};

export function ComplianceChecklistPanel({
  outcomes,
  missingFormFields = [],
  title = "Missouri compliance checks",
}: ComplianceChecklistPanelProps) {
  const passCount = outcomes.filter((o) => o.status === "pass").length;

  const buckets: Record<ComplianceResultCode, ComplianceCheckOutcome[]> = {
    OK: [],
    MISSING_REQUIRED_FIELD: [],
    NEEDS_REVIEW: [],
    WARNING: [],
    LABEL_VERIFICATION_REQUIRED: [],
    SOURCE_UNAVAILABLE: [],
    BLOCKED_BY_EXPLICIT_RULE: [],
  };
  for (const o of outcomes) {
    if (isSurfaced(o)) buckets[o.resultCode].push(o);
  }

  const surfacedCount =
    BUCKET_ORDER.reduce((sum, code) => sum + buckets[code].length, 0) +
    missingFormFields.length;

  const allGreen = surfacedCount === 0;

  return (
    <div
      role={allGreen ? undefined : "alert"}
      data-testid="compliance-checklist-panel"
      style={{
        border: `1px solid ${allGreen ? "var(--color-primary, #16a34a)" : "var(--color-border, #d1d5db)"}`,
        borderRadius: 8,
        padding: 12,
        backgroundColor: allGreen
          ? "var(--color-primary-light, rgba(22,163,74,0.08))"
          : "var(--color-surface, #ffffff)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {allGreen ? `✓ ${title} — all clear` : title}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge style={BUCKET_STYLES.OK} count={passCount} />
          {BUCKET_ORDER.map((code) => {
            const n = buckets[code].length;
            if (n === 0) return null;
            return <Badge key={code} style={BUCKET_STYLES[code]} count={n} />;
          })}
        </div>
      </div>

      {missingFormFields.length > 0 && (
        <section
          data-testid="compliance-form-fields"
          style={{
            backgroundColor: BUCKET_STYLES.MISSING_REQUIRED_FIELD.bg,
            border: `1px solid ${BUCKET_STYLES.MISSING_REQUIRED_FIELD.border}`,
            borderRadius: 6,
            padding: 10,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: BUCKET_STYLES.MISSING_REQUIRED_FIELD.fg,
              marginBottom: 6,
            }}
          >
            Form fields not yet filled in
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12,
              color: BUCKET_STYLES.MISSING_REQUIRED_FIELD.fg,
            }}
          >
            {missingFormFields.map((label) => (
              <li key={`form-missing-${label}`}>{label}</li>
            ))}
          </ul>
        </section>
      )}

      {BUCKET_ORDER.map((code) => {
        const items = buckets[code];
        if (items.length === 0) return null;
        const style = BUCKET_STYLES[code];
        return (
          <section
            key={code}
            data-testid={`compliance-bucket-${code}`}
            style={{
              backgroundColor: style.bg,
              border: `1px solid ${style.border}`,
              borderRadius: 6,
              padding: 10,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: style.fg,
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {style.icon} {style.label} ({items.length})
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12,
                color: style.fg,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {items.map((o) => (
                <li
                  key={o.ruleId}
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <span>{o.message}</span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Citation text={o.citationShort} />
                    <code
                      style={{
                        fontSize: 10,
                        color: "#6b7280",
                      }}
                    >
                      {o.ruleId}
                    </code>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
