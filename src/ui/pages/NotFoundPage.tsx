import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 16, color: "var(--color-border)" }}>🔍</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Page Not Found</h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", maxWidth: 400, marginBottom: 24 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard" style={{ textDecoration: "none" }}>
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
          Back to Dashboard
        </button>
      </Link>
    </div>
  );
}
