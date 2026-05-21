import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";
import { authenticateForTests, clearTestAuth } from "./testAuth";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
  clearTestAuth();
});

afterEach(() => {
  cleanup();
  clearTestAuth();
});

describe("App auth gate (RequireAuth)", () => {
  it("redirects an unauthenticated visit to /dashboard to the /login page", async () => {
    window.history.pushState({}, "", "/dashboard");
    render(<App />);

    // LoginPage's demo-credentials hint is the most stable signal that we
    // landed on /login rather than the dashboard.
    expect(
      await screen.findByTestId("demo-credentials-hint")
    ).toBeTruthy();
    // The dashboard's "Welcome, ...!" greeting must NOT be on screen.
    expect(screen.queryByText(/Welcome,/i)).toBeNull();
  });

  it("redirects an unauthenticated visit to /records to /login", async () => {
    window.history.pushState({}, "", "/records");
    render(<App />);
    expect(
      await screen.findByTestId("demo-credentials-hint")
    ).toBeTruthy();
  });

  it("redirects an unauthenticated visit to /reviews to /login", async () => {
    window.history.pushState({}, "", "/reviews");
    render(<App />);
    expect(
      await screen.findByTestId("demo-credentials-hint")
    ).toBeTruthy();
  });

  it("allows an authenticated contractor through to /dashboard", async () => {
    authenticateForTests("contractor");
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    expect(await screen.findByText(/Welcome,/i)).toBeTruthy();
    expect(screen.queryByTestId("demo-credentials-hint")).toBeNull();
  });

  it("allows an authenticated manager through to /reviews", async () => {
    authenticateForTests("manager");
    window.history.pushState({}, "", "/reviews");
    render(<App />);
    // Manager Reviews page heading lands when ReviewQueue mounts.
    expect(
      await screen.findByRole("heading", { name: /Manager Reviews/i })
    ).toBeTruthy();
  });

  it("Sign out clears the session and bounces back to /login", async () => {
    authenticateForTests("manager");
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    expect(await screen.findByText(/Welcome,/i)).toBeTruthy();

    const user = userEvent.setup();
    await user.click(screen.getByTestId("sign-out-button"));

    // After logout we should be on /login — demo-credentials-hint is the
    // marker. Dashboard greeting is gone.
    expect(
      await screen.findByTestId("demo-credentials-hint")
    ).toBeTruthy();
    expect(screen.queryByText(/Welcome,/i)).toBeNull();

    // And the localStorage entry is gone — refresh would also land on /login.
    expect(window.localStorage.getItem("fieldlog-demo-session")).toBeNull();
  });

  it("session persists across an <App /> remount (the localStorage hydration path)", async () => {
    authenticateForTests("contractor");
    window.history.pushState({}, "", "/dashboard");
    const first = render(<App />);
    expect(await screen.findByText(/Welcome,/i)).toBeTruthy();
    first.unmount();

    // Re-mount — the session should hydrate from localStorage and skip /login.
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    expect(await screen.findByText(/Welcome,/i)).toBeTruthy();
    expect(screen.queryByTestId("demo-credentials-hint")).toBeNull();
  });

  it("a successful login on /login lands on the previously-attempted protected route", async () => {
    window.history.pushState({}, "", "/contractors");
    render(<App />);
    // Got bounced to /login because we're unauthenticated.
    await screen.findByTestId("demo-credentials-hint");

    const user = userEvent.setup();
    await user.click(screen.getByTestId("quick-login-manager"));

    // After login we should land on /contractors (where we were headed),
    // not /dashboard. ContractorsPage heading is the marker.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /^Contractors$/i })
      ).toBeTruthy();
    });
  });
});
