import { useState } from "react";
import { Link } from "react-router-dom";
import { useAllApplicationRecords } from "../../db/queries";

type TabFilter = "all" | "draft" | "submitted" | "locked";

export function RecordsListPage() {
  const records = useAllApplicationRecords();
  const [filter, setFilter] = useState<TabFilter>("all");

  const filteredRecords =
    filter === "all"
      ? records
      : records.filter((r) => {
          if (filter === "locked") return r.workflowStatus === "locked" || r.workflowStatus === "accepted";
          return r.workflowStatus === filter;
        });

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Drafts" },
    { key: "submitted", label: "Submitted" },
    { key: "locked", label: "Locked" },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          Records ({filteredRecords.length})
        </h1>
        <Link to="/records/new" style={{ textDecoration: "none" }}>
          <button style={{
            height: 40,
            padding: "0 16px",
            backgroundColor: "var(--color-primary)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}>
            + New Record
          </button>
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--color-border)", paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: filter === tab.key ? "2px solid var(--color-primary)" : "2px solid transparent",
              backgroundColor: "transparent",
              color: filter === tab.key ? "var(--color-primary)" : "var(--color-text-secondary)",
              fontWeight: filter === tab.key ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 150ms ease-in-out",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Records list */}
      {filteredRecords.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: "var(--color-border)" }}>📋</div>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No records found</h3>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", maxWidth: 400 }}>
            {filter === "all"
              ? "Create your first application record to get started."
              : `No ${filter} records.`}
          </p>
          <Link to="/records/new" style={{ textDecoration: "none", marginTop: 24 }}>
            <button style={{
              height: 40,
              padding: "0 16px",
              backgroundColor: "var(--color-primary)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}>
              + New Record
            </button>
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredRecords.map((record) => {
            const statusColors: Record<string, { bg: string; text: string }> = {
              draft: { bg: "#f5f5f5", text: "#646464" },
              submitted: { bg: "#dbeafe", text: "#1e40af" },
              pending_review: { bg: "#fef3c7", text: "#92400e" },
              accepted: { bg: "#dcfce7", text: "#15803d" },
              locked: { bg: "#dcfce7", text: "#15803d" },
              needs_correction: { bg: "#fee2e2", text: "#991b1b" },
            };
            const colors = statusColors[record.workflowStatus] || statusColors.draft;

            return (
              <div
                key={record.id}
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  padding: 16,
                  boxShadow: "var(--shadow-card)",
                  transition: "box-shadow 200ms ease-out, transform 200ms ease-out",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", fontFamily: "'Courier New', monospace" }}>
                      {record.contractorInputs.applicationDate || "No date set"}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--color-text)", marginTop: 4 }}>
                      {record.contractorInputs.fieldName
                        ? `Field: ${record.contractorInputs.fieldName}`
                        : "No field selected"}
                    </div>
                    {record.contractorInputs.productName && (
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-primary)", marginTop: 4 }}>
                        {record.contractorInputs.productName}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "4px 10px",
                      borderRadius: 9999,
                      backgroundColor: colors.bg,
                      color: colors.text,
                      whiteSpace: "nowrap",
                      textTransform: "capitalize",
                    }}>
                      {record.workflowStatus.replace("_", " ")}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: 9999,
                      backgroundColor: "transparent",
                      color: "var(--color-text-secondary)",
                      border: "1px solid var(--color-border)",
                      whiteSpace: "nowrap",
                    }}>
                      {record.syncStatus}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e8e8e8", fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {record.workflowStatus === "draft" && (
                    <Link to={`/records/${record.id}/edit`} style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}>Edit</Link>
                  )}
                  {record.workflowStatus !== "draft" && (
                    <span>ID: {record.id.slice(0, 12)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB for mobile */}
      <Link to="/records/new" className="fab-mobile" style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: "50%",
        backgroundColor: "var(--color-primary)",
        color: "#fff",
        display: "none",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        boxShadow: "var(--shadow-dropdown)",
        textDecoration: "none",
        zIndex: 30,
      }}>
        +
      </Link>

      <style>{`
        @media (max-width: 640px) {
          .fab-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
