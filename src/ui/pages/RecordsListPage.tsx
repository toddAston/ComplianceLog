import { Link } from "react-router-dom";
import { DraftsList } from "../application-record/DraftsList";

// `/records` page. Renders the live DraftsList — the component that owns the
// Submit affordance for applicators, the manager Lock / Request-correction
// affordances, and the audit-packet download buttons. Previous versions
// rendered a static card grid with no submit button, leaving drafts stranded.
export function RecordsListPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Records</h1>
        <Link to="/records/new" style={{ textDecoration: "none" }}>
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
            + New Record
          </button>
        </Link>
      </div>

      <DraftsList />

      {/* FAB for mobile */}
      <Link
        to="/records/new"
        className="fab-mobile"
        style={{
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
        }}
      >
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
