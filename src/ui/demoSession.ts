import type { ActorContext } from "../application/applicationRecordService";

// Prototype-only UI session context. Not domain, not seed data, not auth.
// Replace with real session/auth identity when that lands.

export const DEMO_APPLICATOR_ACTOR: ActorContext = {
  userId: "user-demo-applicator",
  displayName: "Demo Applicator",
};

export const DEMO_MANAGER_ACTOR: ActorContext = {
  userId: "user-demo-manager",
  displayName: "Demo Manager",
};
