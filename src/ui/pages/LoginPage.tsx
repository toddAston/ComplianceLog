import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    // Demo: just navigate to dashboard
    navigate("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-background)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--color-primary)", lineHeight: 1.2 }}>FieldLog</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 8 }}>Record once. Comply everywhere.</p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: 24,
          boxShadow: "var(--shadow-card)",
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: "var(--color-text)" }}>Sign in</h2>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: "8px 12px", backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 6, marginBottom: 16, fontSize: 12, color: "var(--color-error)" }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 4 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 14,
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-text)",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 4 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 14,
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-text)",
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                height: 40,
                backgroundColor: "var(--color-primary)",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 150ms ease-in-out",
              }}
            >
              Sign in
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <a href="/forgot-password" style={{ fontSize: 12, color: "var(--color-primary)", textDecoration: "none" }}>
              Forgot password?
            </a>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "var(--color-text-secondary)" }}>
          Don't have an account?{" "}
          <a href="/signup" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}>
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
