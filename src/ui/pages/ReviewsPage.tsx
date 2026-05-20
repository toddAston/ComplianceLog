import { useAllApplicationRecords } from "../../db/queries";

export function ReviewsPage() {
  const records = useAllApplicationRecords();
  const pendingRecords = records.filter((r) => r.workflowStatus === "submitted" || r.workflowStatus === "pending_review");
  const lockedRecords = records.filter((r) => r.workflowStatus === "locked" || r.workflowStatus === "accepted");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Manager Reviews</h1>

      {/* Metrics bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <MetricCard label="Pending Review" value={pendingRecords.length} color="var(--color-accent)" />
        <MetricCard label="Locked This Week" value={lockedRecords.length} color="var(--color-success)" />
        <MetricCard label="Overdue (3-Day)" value={0} color="var(--color-error)" />
      </div>

      {/* Review table */}
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Pending Records</h2>

      {pendingRecords.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: "var(--color-border)" }}>✓</div>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>All caught up!</h3>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>No records pending review.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pendingRecords.map((record) => (
            <div
              key={record.id}
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 16,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {record.contractorInputs.applicationDate || "No date"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                    Applicator: {record.contractorInputs.applicatorName || "Unknown"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{
                    height: 32,
                    padding: "0 12px",
                    backgroundColor: "var(--color-primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}>
                    Approve
                  </button>
                  <button style={{
                    height: 32,
                    padding: "0 12px",
                    backgroundColor: "transparent",
                    color: "var(--color-error)",
                    border: "1px solid var(--color-error)",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}>
                    Request Correction
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      backgroundColor: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      padding: 16,
      boxShadow: "var(--shadow-card)",
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Courier New', monospace" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{label}</div>
    </div>
  );
}
