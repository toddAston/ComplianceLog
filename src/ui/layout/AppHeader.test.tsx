import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "../session/SessionContext";
import { AppHeader } from "./AppHeader";

afterEach(() => cleanup());

describe("AppHeader", () => {
  it("renders SyncControls (sync now button) so manual sync is reachable from every page", () => {
    render(
      <SessionProvider>
        <BrowserRouter>
          <AppHeader />
        </BrowserRouter>
      </SessionProvider>
    );
    // SyncControls renders a "Sync now" button — check by accessible name or testid.
    expect(screen.getByRole("button", { name: /sync/i })).toBeTruthy();
  });
});
