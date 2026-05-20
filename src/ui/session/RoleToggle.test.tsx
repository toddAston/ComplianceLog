import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleToggle } from "./RoleToggle";
import { SessionProvider, useSessionRole } from "./SessionContext";

afterEach(() => {
  cleanup();
});

function RoleProbe() {
  return <span data-testid="active-role">{useSessionRole()}</span>;
}

describe("RoleToggle", () => {
  it("renders both contractor and manager buttons", async () => {
    render(
      <SessionProvider>
        <RoleToggle />
      </SessionProvider>
    );
    expect(
      await screen.findByRole("button", { name: /contractor view/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /manager view/i })
    ).toBeTruthy();
  });

  it("reflects the active role with aria-pressed", async () => {
    render(
      <SessionProvider initialRole="manager">
        <RoleToggle />
      </SessionProvider>
    );
    const manager = await screen.findByRole("button", {
      name: /manager view/i,
    });
    const contractor = screen.getByRole("button", {
      name: /contractor view/i,
    });
    expect(manager.getAttribute("aria-pressed")).toBe("true");
    expect(contractor.getAttribute("aria-pressed")).toBe("false");
  });

  it("flips the session role when the other button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider initialRole="contractor">
        <RoleToggle />
        <RoleProbe />
      </SessionProvider>
    );
    expect((await screen.findByTestId("active-role")).textContent).toBe(
      "contractor"
    );
    await user.click(screen.getByRole("button", { name: /manager view/i }));
    expect(screen.getByTestId("active-role").textContent).toBe("manager");
  });

  it("ignores deselection clicks (keeps a role selected)", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider initialRole="contractor">
        <RoleToggle />
        <RoleProbe />
      </SessionProvider>
    );
    const contractor = await screen.findByRole("button", {
      name: /contractor view/i,
    });
    await user.click(contractor);
    expect(screen.getByTestId("active-role").textContent).toBe("contractor");
  });
});
