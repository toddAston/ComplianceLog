import { Link } from "react-router-dom";
import { ReviewQueue } from "../application-record/ReviewQueue";
import { useSessionRole } from "../session/SessionContext";

// `/reviews` page. Renders the live ReviewQueue — the component that owns the
// manager Lock and Request-correction handlers with their review-notes /
// correction-notes inputs. Previous versions rendered a static card list with
// `<button>Approve</button>` mockups that had no onClick handlers at all, so
// the buttons appeared but did nothing.
//
// Page-level role gate: only managers see the queue. Non-managers see a
// friendly empty state directing them to switch demo roles. This is UI
// scaffolding only — see "Trust Boundary" in CLAUDE.md; real authorization
// must be enforced server-side once a backend lands.
export function ReviewsPage() {
  const role = useSessionRole();

  if (role !== "manager") {
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
          Manager Reviews
        </h1>
        <div
          data-testid="reviews-manager-gate"
          style={{
            border: "1px solid var(--color-border, #E0E0E0)",
            borderRadius: 8,
            padding: 24,
            backgroundColor: "var(--color-surface, #fff)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Manager access required
          </h2>
          <p style={{ marginBottom: 16, color: "var(--color-text-secondary, #555)" }}>
            Switch your demo role to Manager from the Dashboard or mobile menu
            to review pending submissions.
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
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        Manager Reviews
      </h1>
      <ReviewQueue />
    </div>
  );
}
