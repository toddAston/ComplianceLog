import { Navigate, useLocation } from "react-router-dom";
import { type ReactElement } from "react";
import { useSession } from "./SessionContext";

// Demo auth gate: redirects to /login when the session is not marked
// authenticated. There is no real auth — see CLAUDE.md "Trust Boundary".
// When a real backend lands this becomes a token-validity check + a refresh
// path; the surface (block-or-pass) stays the same.
export function RequireAuth({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  const { isAuthenticated } = useSession();
  const location = useLocation();
  if (!isAuthenticated) {
    // Preserve the originally-requested path in `from` state so the login
    // page can redirect back to it after a successful sign-in.
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return children;
}
