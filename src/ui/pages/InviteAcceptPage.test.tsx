import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../../App";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";
import { clearTestAuth } from "../session/testAuth";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
  clearTestAuth();
});

afterEach(() => {
  cleanup();
  clearTestAuth();
});

describe("InviteAcceptPage", () => {
  it("renders the invite landing for an unauthenticated visitor (route is public)", async () => {
    window.history.pushState({}, "", "/invite/00000000-aaaa-bbbb-cccc-deadbeef0001");
    render(<App />);

    expect(
      await screen.findByTestId("invite-accept-page")
    ).toBeTruthy();
    expect(screen.getByTestId("invite-token").textContent).toBe(
      "00000000-aaaa-bbbb-cccc-deadbeef0001"
    );
  });

  it("does NOT redirect to /login when unauthenticated (the route sits outside RequireAuth)", async () => {
    window.history.pushState({}, "", "/invite/some-token");
    render(<App />);
    // LoginPage marker would be present if RequireAuth had bounced us.
    expect(screen.queryByTestId("demo-credentials-hint")).toBeNull();
    expect(await screen.findByTestId("invite-accept-page")).toBeTruthy();
  });

  it("offers a 'Sign in to FieldLog' action that links to /login", async () => {
    window.history.pushState({}, "", "/invite/anything");
    render(<App />);
    const link = await screen.findByRole("link", {
      name: /Sign in to FieldLog/i,
    });
    expect(link.getAttribute("href")).toBe("/login");
  });
});
