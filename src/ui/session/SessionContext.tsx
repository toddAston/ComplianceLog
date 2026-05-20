import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ActorContext } from "../../application/applicationRecordService";
import {
  DEMO_APPLICATOR_ACTOR,
  DEMO_MANAGER_ACTOR,
} from "../demoSession";

export type SessionRole = "contractor" | "manager";

export type SessionValue = {
  role: SessionRole;
  actor: ActorContext;
  setRole: (role: SessionRole) => void;
};

const defaultValue: SessionValue = {
  role: "manager",
  actor: DEMO_MANAGER_ACTOR,
  setRole: () => undefined,
};

const SessionContext = createContext<SessionValue>(defaultValue);

const actorForRole = (role: SessionRole): ActorContext =>
  role === "manager" ? DEMO_MANAGER_ACTOR : DEMO_APPLICATOR_ACTOR;

export type SessionProviderProps = {
  initialRole?: SessionRole;
  children: ReactNode;
};

export function SessionProvider({
  initialRole = "contractor",
  children,
}: SessionProviderProps) {
  const [role, setRole] = useState<SessionRole>(initialRole);
  const value = useMemo<SessionValue>(
    () => ({ role, actor: actorForRole(role), setRole }),
    [role]
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
