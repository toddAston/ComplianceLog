import { Link } from "react-router-dom";
import { ContractorManager } from "../contractor/ContractorManager";
import { useSessionRole } from "../session/SessionContext";
import { DEMO_ORG_ID } from "../../db/seed";

// `/contractors` page — manager-only deep link to the ContractorManager
// invite + applicator-listing flow that previously lived only inside the
// Settings page. Wiring it here gives the Dashboard's "Invite Contractors"
// quick-action a real target. Mirrors the role gate used on /reviews so a
// contractor URL-hitting the route sees a friendly message instead of the
// manager-only UI.
export function ContractorsPage() {
  const role = useSessionRole();
  if (role !== "manager") {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          Manager access required
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            marginBottom: 24,
          }}
        >
          Switch your demo role to Manager from the Dashboard or mobile menu
          to invite contractors and review their applicators.
        </p>
        <Link to="/records" style={{ textDecoration: "none" }}>
          <button
            style={{
              height: 40,
              padding: "0 16px",
              backgroundColor: "var(--color-primary)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Back to Records
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        Contractors
      </h1>
      <ContractorManager organizationId={DEMO_ORG_ID} />
    </div>
  );
}
