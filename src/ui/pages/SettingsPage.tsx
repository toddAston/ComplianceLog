import { useSession } from "../session/SessionContext";
import { FarmManager } from "../farm/FarmManager";
import { ContractorManager } from "../contractor/ContractorManager";
import { DEMO_ORG_ID } from "../../db/seed";

export function SettingsPage() {
  const { role, actor } = useSession();

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>Settings</h1>

      {/* Profile Section */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Profile</h2>
        <div style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: 24,
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "var(--color-primary)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
            }}>
              {actor.actorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{actor.actorName}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {role === "manager" ? "Manager" : "Applicator"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DetailRow label="Name" value={actor.actorName} />
            <DetailRow label="Role" value={role === "manager" ? "Manager" : "Applicator"} />
            <DetailRow label="Actor ID" value={actor.actorId.slice(0, 12) + "..."} />
          </div>
        </div>
      </section>

      {/* Manager-only sections */}
      {role === "manager" && (
        <>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Farm Management</h2>
            <FarmManager organizationId={DEMO_ORG_ID} />
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Contractors</h2>
            <ContractorManager organizationId={DEMO_ORG_ID} />
          </section>
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #e8e8e8" }}>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
