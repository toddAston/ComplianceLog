import { Link } from "react-router-dom";
import { useSession } from "../session/SessionContext";

type Props = {
  open: boolean;
  onClose: () => void;
  navLinks: { to: string; label: string }[];
};

export function MobileMenu({ open, onClose, navLinks }: Props) {
  const { role, setRole } = useSession();

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-overlay)" as unknown as number,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--color-background)",
          borderRadius: "16px 16px 0 0",
          padding: 24,
          maxHeight: "80vh",
          animation: "slideUp 300ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 40,
            height: 4,
            backgroundColor: "var(--color-border)",
            borderRadius: 2,
            margin: "0 auto 24px",
          }}
        />

        <div style={{ fontWeight: 700, fontSize: 20, color: "var(--color-primary)", marginBottom: 24 }}>
          FieldLog
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={onClose}
              style={{
                textDecoration: "none",
                padding: "12px 16px",
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 500,
                color: "var(--color-text)",
                backgroundColor: "transparent",
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>
            DEMO ROLE
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setRole("contractor"); onClose(); }}
              style={{
                flex: 1,
                padding: "10px",
                border: role === "contractor" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                borderRadius: 6,
                background: role === "contractor" ? "var(--color-primary-light)" : "transparent",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
                color: "var(--color-text)",
              }}
            >
              Applicator
            </button>
            <button
              onClick={() => { setRole("manager"); onClose(); }}
              style={{
                flex: 1,
                padding: "10px",
                border: role === "manager" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                borderRadius: 6,
                background: role === "manager" ? "var(--color-primary-light)" : "transparent",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
                color: "var(--color-text)",
              }}
            >
              Manager
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "12px",
            border: "none",
            borderRadius: 6,
            backgroundColor: "var(--color-surface)",
            color: "var(--color-text-secondary)",
            fontWeight: 500,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
