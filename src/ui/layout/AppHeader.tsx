import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSession } from "../session/SessionContext";
import { MobileMenu } from "./MobileMenu";

export function AppHeader() {
  const { role, actor } = useSession();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/records", label: "Records" },
    ...(role === "manager" ? [{ to: "/reviews", label: "Reviews" }] : []),
    { to: "/settings", label: "Settings" },
  ];

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          backgroundColor: "var(--color-background)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          zIndex: "var(--z-header)",
        }}
      >
        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="mobile-only"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            display: "none",
            fontSize: 20,
            color: "var(--color-text)",
          }}
        >
          ☰
        </button>

        {/* Logo */}
        <Link
          to="/dashboard"
          style={{
            textDecoration: "none",
            color: "var(--color-primary)",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "-0.02em",
          }}
        >
          FieldLog
        </Link>

        {/* Desktop nav */}
        <nav
          className="desktop-nav"
          style={{
            display: "flex",
            gap: 24,
            marginLeft: 32,
            alignItems: "center",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                textDecoration: "none",
                fontSize: 14,
                fontWeight: location.pathname.startsWith(link.to) ? 600 : 400,
                color: location.pathname.startsWith(link.to)
                  ? "var(--color-primary)"
                  : "var(--color-text-secondary)",
                transition: "color 150ms ease-in-out",
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side: user info */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "2px 10px",
              borderRadius: 9999,
              backgroundColor:
                role === "manager" ? "#FCE4EC" : "#E3F2FD",
              color: role === "manager" ? "#C2185B" : "#1976D2",
            }}
          >
            {role === "manager" ? "Manager" : "Applicator"}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            {actor.actorName}
          </span>
        </div>
      </header>

      {/* Mobile menu */}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} navLinks={navLinks} />

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .mobile-only { display: flex !important; }
          .desktop-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
