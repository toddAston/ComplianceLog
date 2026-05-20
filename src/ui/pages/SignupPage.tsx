import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StepperLayout } from "../layout/StepperLayout";

export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"applicator" | "manager">("applicator");
  const [certNumber, setCertNumber] = useState("");
  const [error, setError] = useState("");

  const handleNext = () => {
    if (step === 0) {
      if (!email || !password) { setError("All fields required"); return; }
      if (password !== confirmPassword) { setError("Passwords don't match"); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
      setError("");
      setStep(1);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-background)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--color-primary)" }}>FieldLog</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 8 }}>Create your account</p>
        </div>

        <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 24, boxShadow: "var(--shadow-card)" }}>
          <StepperLayout
            currentStep={step}
            totalSteps={2}
            stepLabels={["Email & Password", "Role & Certification"]}
            onBack={() => setStep(0)}
            onNext={handleNext}
            nextLabel={step === 1 ? "Create Account" : "Next"}
          >
            {error && (
              <div style={{ padding: "8px 12px", backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 6, marginBottom: 16, fontSize: 12, color: "var(--color-error)" }}>
                {error}
              </div>
            )}

            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Email <span style={{ color: "var(--color-error)" }}>*</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"
                    style={{ width: "100%", height: 40, padding: "0 12px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 14, backgroundColor: "var(--color-background)" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Password <span style={{ color: "var(--color-error)" }}>*</span></label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters"
                    style={{ width: "100%", height: 40, padding: "0 12px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 14, backgroundColor: "var(--color-background)" }} />
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Must contain letter + number</span>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Confirm Password <span style={{ color: "var(--color-error)" }}>*</span></label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password"
                    style={{ width: "100%", height: 40, padding: "0 12px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 14, backgroundColor: "var(--color-background)" }} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Role <span style={{ color: "var(--color-error)" }}>*</span></label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {(["applicator", "manager"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        style={{
                          flex: 1,
                          padding: "12px",
                          border: role === r ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                          borderRadius: 6,
                          backgroundColor: role === r ? "var(--color-primary-light)" : "transparent",
                          cursor: "pointer",
                          fontWeight: 500,
                          fontSize: 14,
                          color: "var(--color-text)",
                          textTransform: "capitalize",
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {role === "applicator" && (
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Certification Number</label>
                    <input type="text" value={certNumber} onChange={(e) => setCertNumber(e.target.value)} placeholder="e.g., MO-12345"
                      style={{ width: "100%", height: 40, padding: "0 12px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 14, backgroundColor: "var(--color-background)" }} />
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Optional — can add later in Settings</span>
                  </div>
                )}
              </div>
            )}
          </StepperLayout>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "var(--color-text-secondary)" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}>Sign in</a>
        </div>
      </div>
    </div>
  );
}
