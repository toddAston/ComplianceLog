import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../session/SessionContext";

// Demo-only credentials. There is no real auth. The "login" exists so the
// demo viewer can land in either the contractor or manager experience without
// hunting for the role toggle. See CLAUDE.md "Trust Boundary" — these will be
// replaced wholesale when a real auth backend lands.
const DEMO_CREDENTIALS: Record<string, { password: string; role: "contractor" | "manager" }> = {
  contractor: { password: "password", role: "contractor" },
  manager: { password: "password", role: "manager" },
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // If RequireAuth bounced the user here from a protected route, that path
  // is stashed in location.state.from — return them there after sign-in.
  // Otherwise default to /dashboard.
  const from =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  // Already signed in (e.g. user typed /login in the URL) → bounce to where
  // they were headed without making them re-enter credentials.
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }
    const cred = DEMO_CREDENTIALS[username.trim().toLowerCase()];
    if (!cred || cred.password !== password) {
      setError("Invalid credentials. Try contractor:password or manager:password.");
      return;
    }
    login(cred.role);
    navigate(from, { replace: true });
  };

  const quickLogin = (role: "contractor" | "manager") => {
    login(role);
    navigate(from, { replace: true });
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

          {/* Demo-credentials hint, visible by design so anyone landing on the
              page can immediately jump into either role. */}
          <div
            data-testid="demo-credentials-hint"
            style={{
              padding: "10px 12px",
              backgroundColor: "rgba(37,99,235,0.08)",
              border: "1px solid rgba(37,99,235,0.3)",
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 12,
              color: "var(--color-text)",
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Demo credentials</div>
            <div><code>contractor</code> / <code>password</code></div>
            <div><code>manager</code> / <code>password</code></div>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                data-testid="login-error"
                style={{ padding: "8px 12px", backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 6, marginBottom: 16, fontSize: 12, color: "var(--color-error)" }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="login-username" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 4 }}>Username</label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="contractor or manager"
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
              <label htmlFor="login-password" style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 4 }}>Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
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

          {/* One-click jump buttons for the demo — bypass the form entirely. */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              data-testid="quick-login-contractor"
              onClick={() => quickLogin("contractor")}
              style={{
                flex: 1,
                height: 36,
                backgroundColor: "transparent",
                color: "var(--color-primary)",
                border: "1px solid var(--color-primary)",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Enter as Contractor
            </button>
            <button
              type="button"
              data-testid="quick-login-manager"
              onClick={() => quickLogin("manager")}
              style={{
                flex: 1,
                height: 36,
                backgroundColor: "transparent",
                color: "var(--color-primary)",
                border: "1px solid var(--color-primary)",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Enter as Manager
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "var(--color-primary)", textDecoration: "none" }}>
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
