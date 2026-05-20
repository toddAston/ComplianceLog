import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SessionProvider,
  useSession,
  useSessionActor,
  useSessionRole,
} from "./SessionContext";
import {
  DEMO_APPLICATOR_ACTOR,
  DEMO_MANAGER_ACTOR,
} from "../demoSession";

afterEach(() => {
  cleanup();
});

function Probe() {
  const { role, actor, setRole } = useSession();
  return (
    <div>
      <span data-testid="role">{role}</span>
      <span data-testid="actor-id">{actor.userId}</span>
      <button onClick={() => setRole("manager")}>Be manager</button>
      <button onClick={() => setRole("contractor")}>Be contractor</button>
    </div>
  );
}

describe("SessionContext", () => {
  it("defaults to contractor role with the contractor demo actor", async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    );
    expect((await screen.findByTestId("role")).textContent).toBe("contractor");
    expect(screen.getByTestId("actor-id").textContent).toBe(
      DEMO_APPLICATOR_ACTOR.userId
    );
  });

  it("respects initialRole when provided", async () => {
    render(
      <SessionProvider initialRole="manager">
        <Probe />
      </SessionProvider>
    );
    expect((await screen.findByTestId("role")).textContent).toBe("manager");
    expect(screen.getByTestId("actor-id").textContent).toBe(
      DEMO_MANAGER_ACTOR.userId
    );
  });

  it("swaps the actor when the role changes", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    );
    await user.click(screen.getByRole("button", { name: /be manager/i }));
    expect(screen.getByTestId("role").textContent).toBe("manager");
    expect(screen.getByTestId("actor-id").textContent).toBe(
      DEMO_MANAGER_ACTOR.userId
    );

    await user.click(screen.getByRole("button", { name: /be contractor/i }));
    expect(screen.getByTestId("role").textContent).toBe("contractor");
    expect(screen.getByTestId("actor-id").textContent).toBe(
      DEMO_APPLICATOR_ACTOR.userId
    );
  });

  function StandaloneProbe() {
    return (
      <div>
        <span data-testid="standalone-role">{useSessionRole()}</span>
        <span data-testid="standalone-actor">
          {useSessionActor().userId}
        </span>
      </div>
    );
  }

  it("falls back to manager defaults when used outside a provider", () => {
    render(<StandaloneProbe />);
    expect(screen.getByTestId("standalone-role").textContent).toBe("manager");
    expect(screen.getByTestId("standalone-actor").textContent).toBe(
      DEMO_MANAGER_ACTOR.userId
    );
  });
});
