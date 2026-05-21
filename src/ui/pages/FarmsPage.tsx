import { Link } from "react-router-dom";
import { FarmManager } from "../farm/FarmManager";
import { useSessionRole } from "../session/SessionContext";
import { DEMO_ORG_ID } from "../../db/seed";

// `/farms` page — manager-only deep link to the FarmManager flow that
// previously lived as a section inside the Settings page. Pulled out so
// Settings only carries account-level configuration. Mirrors the role gate
// used on /reviews and /contractors so a contractor URL-hitting the route
// sees a friendly message instead of the manager-only UI.
export function FarmsPage() {
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
          to manage farms and field sites.
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
        Farm Management
      </h1>
      <FarmManager organizationId={DEMO_ORG_ID} />
    </div>
  );
}
