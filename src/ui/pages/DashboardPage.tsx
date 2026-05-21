import { Link } from "react-router-dom";
import { useSession } from "../session/SessionContext";
import { useAllApplicationRecords } from "../../db/queries";
import type { ApplicationRecord } from "../../domain/types";

export function DashboardPage() {
  const { role, actor } = useSession();
  const records = useAllApplicationRecords();

  const draftCount = records.filter((r) => r.workflowStatus === "draft").length;
  const submittedCount = records.filter((r) => r.workflowStatus === "submitted").length;
  const lockedCount = records.filter((r) => r.workflowStatus === "locked").length;
  const pendingCount = records.filter((r) => r.workflowStatus === "submitted" || r.workflowStatus === "pending_review").length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Welcome */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            Welcome, {actor.displayName}! 👋
          </h1>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 10px",
            borderRadius: 9999,
            backgroundColor: role === "manager" ? "#FCE4EC" : "#E3F2FD",
            color: role === "manager" ? "#C2185B" : "#1976D2",
          }}>
            {role === "manager" ? "Manager" : "Applicator"}
          </span>
        </div>
      </div>

      {/* Applicator Dashboard */}
      {role === "contractor" && (
        <>
          {/* Stats */}
          <StatStrip
            items={[
              { label: "Drafts", value: draftCount, color: "var(--color-text-secondary)" },
              { label: "Submitted", value: submittedCount, color: "var(--color-primary)" },
              { label: "Locked", value: lockedCount, color: "var(--color-success)" },
            ]}
          />

          {/* Quick actions */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
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
            <Link to="/records" style={{ textDecoration: "none" }}>
              <button style={{
                height: 40,
                padding: "0 16px",
                backgroundColor: "transparent",
                color: "var(--color-primary)",
                border: "1px solid var(--color-primary)",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}>
                View All Records
              </button>
            </Link>
          </div>

          {/* Recent records */}
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Recent Records</h2>
          {records.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {records.slice(0, 5).map((r) => (
                <RecordCard key={r.id} record={r} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Manager Dashboard */}
      {role === "manager" && (
        <>
          <StatStrip
            items={[
              { label: "Pending Review", value: pendingCount, color: "var(--color-accent)" },
              { label: "Submitted This Week", value: submittedCount, color: "var(--color-primary)" },
              { label: "Locked", value: lockedCount, color: "var(--color-success)" },
            ]}
          />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
            <Link to="/reviews" style={{ textDecoration: "none" }}>
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
                Review Records
              </button>
            </Link>
            <Link
              to="/contractors"
              style={{ textDecoration: "none" }}
              data-testid="dashboard-invite-contractors"
            >
              <button style={{
                height: 40,
                padding: "0 16px",
                backgroundColor: "transparent",
                color: "var(--color-primary)",
                border: "1px solid var(--color-primary)",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}>
                Invite Contractors
              </button>
            </Link>
            <Link
              to="/farms"
              style={{ textDecoration: "none" }}
              data-testid="dashboard-manage-farms"
            >
              <button style={{
                height: 40,
                padding: "0 16px",
                backgroundColor: "transparent",
                color: "var(--color-primary)",
                border: "1px solid var(--color-primary)",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}>
                Manage Farms
              </button>
            </Link>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Pending Reviews</h2>
          {pendingCount === 0 ? (
            <EmptyState message="No records pending review" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {records.filter((r) => r.workflowStatus === "submitted" || r.workflowStatus === "pending_review").slice(0, 5).map((r) => (
                <RecordCard key={r.id} record={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>;
}) {
  return (
    <div
      aria-label="Record counts"
      style={{
        display: "flex",
        alignItems: "stretch",
        marginBottom: 24,
        padding: "2px 0",
      }}
    >
      {items.map((item, idx) => (
        <div
          key={item.label}
          style={{
            flex: "1 1 0",
            padding: "2px 14px",
            borderRight:
              idx < items.length - 1
                ? "1px solid var(--color-border)"
                : "none",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: item.color,
              fontFamily: "'Courier New', monospace",
              lineHeight: 1.1,
            }}
          >
            {item.value}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function RecordCard({ record }: { record: ApplicationRecord }) {
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
    <Link to="/records" style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: 16,
        boxShadow: "var(--shadow-card)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transition: "box-shadow 200ms ease-out",
        cursor: "pointer",
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)" }}>
            {record.contractorInputs.applicationDate || "No date"}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
            {record.contractorInputs.fieldName || `ID: ${record.id.slice(0, 8)}...`}
          </div>
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          padding: "4px 10px",
          borderRadius: 9999,
          backgroundColor: colors.bg,
          color: colors.text,
          textTransform: "capitalize",
        }}>
          {record.workflowStatus.replace("_", " ")}
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ message = "No records yet" }: { message?: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 48,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16, color: "var(--color-border)" }}>📋</div>
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{message}</h3>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", maxWidth: 400 }}>
        Create your first application record to get started with compliance tracking.
      </p>
    </div>
  );
}
