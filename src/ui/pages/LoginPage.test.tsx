import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider, useSession } from "../session/SessionContext";
import { LoginPage } from "./LoginPage";

// Captures the current session role from inside the tree so each test can
// assert what login set it to. This is the only reliable way to confirm
// the demo-cred → role mapping without a routed integration test.
function RoleProbe({ onRender }: { onRender: (role: string) => void }) {
  const { role } = useSession();
  onRender(role);
  return null;
}

const renderLogin = (initialRole: "contractor" | "manager" = "contractor") => {
  let observedRole = "";
  const utils = render(
    <SessionProvider initialRole={initialRole}>
      <BrowserRouter>
        <LoginPage />
        <RoleProbe onRender={(role) => (observedRole = role)} />
      </BrowserRouter>
    </SessionProvider>
  );
  return { ...utils, getObservedRole: () => observedRole };
};

afterEach(() => {
  cleanup();
});

describe("LoginPage demo credentials", () => {
  it("renders the demo-credentials hint so the viewer always sees the working creds", () => {
    renderLogin();
    const hint = screen.getByTestId("demo-credentials-hint");
    expect(within(hint).getByText("contractor")).toBeTruthy();
    expect(within(hint).getByText("manager")).toBeTruthy();
  });

  it("accepts contractor / password and sets the contractor role", async () => {
    const { getObservedRole } = renderLogin("manager");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Username/i), "contractor");
    await user.type(screen.getByLabelText(/Password/i), "password");
    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    await waitFor(() => expect(getObservedRole()).toBe("contractor"));
    expect(screen.queryByTestId("login-error")).toBeNull();
  });

  it("accepts manager / password and sets the manager role", async () => {
    const { getObservedRole } = renderLogin("contractor");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Username/i), "manager");
    await user.type(screen.getByLabelText(/Password/i), "password");
    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    await waitFor(() => expect(getObservedRole()).toBe("manager"));
    expect(screen.queryByTestId("login-error")).toBeNull();
  });

  it("is case-insensitive on the username", async () => {
    const { getObservedRole } = renderLogin("contractor");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Username/i), "Manager");
    await user.type(screen.getByLabelText(/Password/i), "password");
    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    await waitFor(() => expect(getObservedRole()).toBe("manager"));
  });

  it("rejects an unknown username and shows an inline error", async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Username/i), "ceo");
    await user.type(screen.getByLabelText(/Password/i), "password");
    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    const err = await screen.findByTestId("login-error");
    expect(err.textContent).toMatch(/invalid credentials/i);
  });

  it("rejects a wrong password for a known username", async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Username/i), "manager");
    await user.type(screen.getByLabelText(/Password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    const err = await screen.findByTestId("login-error");
    expect(err.textContent).toMatch(/invalid credentials/i);
  });

  it("requires both fields", async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    const err = await screen.findByTestId("login-error");
    expect(err.textContent).toMatch(/fill in all fields/i);
  });

  it("Quick-login as Contractor button sets the contractor role without typing", async () => {
    const { getObservedRole } = renderLogin("manager");
    const user = userEvent.setup();

    await user.click(screen.getByTestId("quick-login-contractor"));

    await waitFor(() => expect(getObservedRole()).toBe("contractor"));
  });

  it("Quick-login as Manager button sets the manager role without typing", async () => {
    const { getObservedRole } = renderLogin("contractor");
    const user = userEvent.setup();

    await user.click(screen.getByTestId("quick-login-manager"));

    await waitFor(() => expect(getObservedRole()).toBe("manager"));
  });
});

describe("LoginPage navigation", () => {
  it("navigates to /dashboard after a successful login", async () => {
    // After the auth-gate rework, LoginPage uses `navigate(from, { replace: true })`
    // (so /login doesn't accumulate in browser history). Spy on BOTH pushState
    // and replaceState so the assertion catches either navigation form.
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    try {
      renderLogin();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/Username/i), "contractor");
      await user.type(screen.getByLabelText(/Password/i), "password");
      await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

      await waitFor(() => {
        const wentToDashboard = [
          ...pushSpy.mock.calls,
          ...replaceSpy.mock.calls,
        ].some(
          (call) => typeof call[2] === "string" && call[2].endsWith("/dashboard")
        );
        expect(wentToDashboard).toBe(true);
      });
    } finally {
      pushSpy.mockRestore();
      replaceSpy.mockRestore();
    }
  });
});
