import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";
import { SessionProvider } from "../session/SessionContext";
import { FarmsPage } from "./FarmsPage";
import { SettingsPage } from "./SettingsPage";
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

describe("FarmsPage", () => {
  it("renders the FarmManager heading + inputs for a manager", async () => {
    renderRoute(FarmsPage, "manager");
    expect(
      await screen.findByRole("heading", { name: /^Farm Management$/ })
    ).toBeTruthy();
    // FarmManager exposes a "Create farm" submit button on its inline form.
    expect(
      await screen.findByRole("button", { name: /Create farm/i })
    ).toBeTruthy();
  });

  it("shows the role-gate empty state when a contractor URL-hits /farms", async () => {
    renderRoute(FarmsPage, "contractor");
    expect(
      await screen.findByText(/Manager access required/i)
    ).toBeTruthy();
    // The form must NOT render.
    expect(screen.queryByRole("button", { name: /Create farm/i })).toBeNull();
    const back = screen.getByRole("link", { name: /Back to Records/i });
    expect(back.getAttribute("href")).toBe("/records");
  });
});

describe("SettingsPage decluttering", () => {
  it("no longer renders the inline Farm Management section (replaced by a link to /farms)", async () => {
    renderRoute(SettingsPage, "manager");
    // No inline FarmManager — the "Create farm" submit button is the marker.
    expect(screen.queryByRole("button", { name: /Create farm/i })).toBeNull();
    // The new quick-link to /farms is present instead.
    const link = await screen.findByTestId("settings-link-farms");
    expect(link.getAttribute("href")).toBe("/farms");
  });

  it("no longer renders the inline ContractorManager (replaced by a link to /contractors)", async () => {
    renderRoute(SettingsPage, "manager");
    // No inline ContractorManager — its "Send invite" submit button is the marker.
    expect(screen.queryByRole("button", { name: /Send invite/i })).toBeNull();
    const link = await screen.findByTestId("settings-link-contractors");
    expect(link.getAttribute("href")).toBe("/contractors");
  });

  it("hides the Organization section entirely for a contractor", async () => {
    renderRoute(SettingsPage, "contractor");
    expect(screen.queryByTestId("settings-link-farms")).toBeNull();
    expect(screen.queryByTestId("settings-link-contractors")).toBeNull();
  });
});

describe("DashboardPage — Manage Farms quick action now points at /farms", () => {
  it("manager sees a Manage Farms link to /farms (not /settings)", async () => {
    renderRoute(DashboardPage, "manager");
    const link = await screen.findByTestId("dashboard-manage-farms");
    expect(link.getAttribute("href")).toBe("/farms");
    expect(link.textContent).toMatch(/Manage Farms/i);
  });
});
