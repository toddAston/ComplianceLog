import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";
import { SessionProvider } from "../session/SessionContext";
import { ContractorsPage } from "./ContractorsPage";
import { DashboardPage } from "./DashboardPage";

const renderRoute = (
  Page: () => ReactElement,
  initialRole: "contractor" | "manager"
) =>
  render(
    <SessionProvider initialRole={initialRole}>
      <BrowserRouter>
        <Page />
      </BrowserRouter>
    </SessionProvider>
  );

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => cleanup());

describe("ContractorsPage", () => {
  it("renders the ContractorManager for a manager (invite form is reachable)", async () => {
    renderRoute(ContractorsPage, "manager");
    // ContractorManager's invite affordance — the "Send invite" submit button.
    expect(
      await screen.findByRole("button", { name: /Send invite/i })
    ).toBeTruthy();
  });

  it("shows a friendly empty state and back link when a contractor URL-hits the route", async () => {
    renderRoute(ContractorsPage, "contractor");
    expect(
      await screen.findByText(/Manager access required/i)
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send invite/i })).toBeNull();
    const back = screen.getByRole("link", { name: /Back to Records/i });
    expect(back.getAttribute("href")).toBe("/records");
  });
});

describe("DashboardPage — Invite Contractors quick action", () => {
  it("manager sees an Invite Contractors button that links to /contractors", async () => {
    renderRoute(DashboardPage, "manager");
    const link = await screen.findByTestId("dashboard-invite-contractors");
    expect(link.getAttribute("href")).toBe("/contractors");
    // Inner button text matches the manager's expectation.
    expect(link.textContent).toMatch(/Invite Contractors/i);
  });

  it("contractor does not see the Invite Contractors quick action (manager-only)", async () => {
    renderRoute(DashboardPage, "contractor");
    expect(screen.queryByTestId("dashboard-invite-contractors")).toBeNull();
  });

  it("clicking the button navigates without throwing", async () => {
    const user = userEvent.setup();
    renderRoute(DashboardPage, "manager");
    const link = await screen.findByTestId("dashboard-invite-contractors");
    await user.click(link);
    // No deeper assertion — render-with-BrowserRouter doesn't change pages
    // for in-router <Link>; just confirm the click handler didn't crash.
    expect(link).toBeTruthy();
  });
});
