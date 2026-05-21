import { Link } from "react-router-dom";
import { useSession } from "../session/SessionContext";

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
              {actor.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{actor.displayName}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {role === "manager" ? "Manager" : "Applicator"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DetailRow label="Name" value={actor.displayName} />
            <DetailRow label="Role" value={role === "manager" ? "Manager" : "Applicator"} />
            <DetailRow label="User ID" value={actor.userId.slice(0, 12) + "..."} />
          </div>
        </div>
      </section>

      {/* Manager-only quick links to the dedicated management pages. Both
          flows previously lived inline on this page; they were extracted to
          /farms and /contractors so Settings stays focused on profile/account
          configuration. */}
      {role === "manager" && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            Organization
          </h2>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: 16,
              boxShadow: "var(--shadow-card)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <SettingsLink
              to="/farms"
              testid="settings-link-farms"
              label="Farm Management"
              hint="Add or rename farms and field sites."
            />
            <SettingsLink
              to="/contractors"
              testid="settings-link-contractors"
              label="Contractors"
              hint="Invite contractor companies and review their applicators."
            />
          </div>
        </section>
      )}
    </div>
  );
}

function SettingsLink({
  to,
  label,
  hint,
  testid,
}: {
  to: string;
  label: string;
  hint: string;
  testid?: string;
}) {
  return (
    <Link
      to={to}
      data-testid={testid}
      style={{
        textDecoration: "none",
        color: "inherit",
        padding: "12px 14px",
        borderRadius: 6,
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-background)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        cursor: "pointer",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
            marginTop: 2,
          }}
        >
          {hint}
        </div>
      </div>
      <span style={{ color: "var(--color-text-secondary)", fontSize: 18 }}>›</span>
    </Link>
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
