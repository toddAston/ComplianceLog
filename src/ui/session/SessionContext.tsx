import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ActorContext } from "../../application/applicationRecordService";
import {
  DEMO_APPLICATOR_ACTOR,
  DEMO_MANAGER_ACTOR,
} from "../demoSession";

export type SessionRole = "contractor" | "manager";

// Demo-only session persisted to localStorage. There is no real auth — see
// CLAUDE.md "Trust Boundary". A bearer token / refresh flow replaces this
// wholesale once the server lands. Stored shape is intentionally minimal so
// future versions can extend without a hard migration.
const STORAGE_KEY = "fieldlog-demo-session";

type StoredSession = { role: SessionRole };

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.role === "manager" || parsed?.role === "contractor") {
      return { role: parsed.role };
    }
  } catch {
    // corrupted entry — fall through to "not stored".
  }
  return null;
}

function writeStoredSession(s: StoredSession | null): void {
  if (typeof window === "undefined") return;
  if (s === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
}

export type SessionValue = {
  isAuthenticated: boolean;
  role: SessionRole;
  actor: ActorContext;
  setRole: (role: SessionRole) => void;
  // Demo login — sets the role AND marks the session authenticated.
  // Persists to localStorage so refresh keeps the user signed in.
  login: (role: SessionRole) => void;
  // Clears auth + role from memory and localStorage. Routes guarded by
  // <RequireAuth /> will redirect to /login on the next render.
  logout: () => void;
};

// Default context value for components rendered outside a SessionProvider —
// intentionally `role: "manager"` so unit tests that mount feature components
// (DraftsList, ReviewQueue, etc.) directly without a session wrapper still see
// the manager affordances. Production always renders inside SessionProvider so
// this default is invisible there. `isAuthenticated: false` because there is
// no real session to assume.
const defaultValue: SessionValue = {
  isAuthenticated: false,
  role: "manager",
  actor: DEMO_MANAGER_ACTOR,
  setRole: () => undefined,
  login: () => undefined,
  logout: () => undefined,
};

const SessionContext = createContext<SessionValue>(defaultValue);

const actorForRole = (role: SessionRole): ActorContext =>
  role === "manager" ? DEMO_MANAGER_ACTOR : DEMO_APPLICATOR_ACTOR;

export type SessionProviderProps = {
  // When provided, the test/embedder is explicitly asserting "the user is
  // already signed in as this role." Skips the localStorage check and the
  // auth gate. Production renders <SessionProvider/> with no initialRole so
  // the user must walk through the LoginPage.
  initialRole?: SessionRole;
  children: ReactNode;
};

export function SessionProvider({
  initialRole,
  children,
}: SessionProviderProps) {
  // Hydration priority:
  // 1. initialRole prop (tests) → authenticated under that role.
  // 2. localStorage entry → authenticated under the stored role.
  // 3. Neither → unauthenticated; routes redirect to /login.
  const initial = useMemo(() => {
    if (initialRole !== undefined) {
      return { isAuthenticated: true, role: initialRole };
    }
    const stored = readStoredSession();
    if (stored) return { isAuthenticated: true, role: stored.role };
    return { isAuthenticated: false, role: "contractor" as SessionRole };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only seed on mount
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState(
    initial.isAuthenticated
  );
  const [role, setRoleState] = useState<SessionRole>(initial.role);

  const setRole = useCallback(
    (next: SessionRole) => {
      setRoleState(next);
      // Persist only while authenticated — pre-login role flips (e.g. via the
      // unused defaultValue context) should not write storage.
      if (isAuthenticated) writeStoredSession({ role: next });
    },
    [isAuthenticated]
  );

  const login = useCallback((next: SessionRole) => {
    setRoleState(next);
    setIsAuthenticated(true);
    writeStoredSession({ role: next });
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    writeStoredSession(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      isAuthenticated,
      role,
      actor: actorForRole(role),
      setRole,
      login,
      logout,
    }),
    [isAuthenticated, role, setRole, login, logout]
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}

export function useSessionRole(): SessionRole {
  return useContext(SessionContext).role;
}

export function useSessionActor(): ActorContext {
  return useContext(SessionContext).actor;
}
