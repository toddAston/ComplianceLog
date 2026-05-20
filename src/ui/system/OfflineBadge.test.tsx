import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OfflineBadge } from "./OfflineBadge";

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

const originalOnLine = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "onLine"
);

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  cleanup();
  if (originalOnLine) {
    Object.defineProperty(Navigator.prototype, "onLine", originalOnLine);
  }
});

describe("OfflineBadge", () => {
  it("renders nothing while online", () => {
    setOnline(true);
    const { container } = render(<OfflineBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an aria-live status banner while offline", () => {
    setOnline(false);
    render(<OfflineBadge />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toMatch(/offline/i);
    expect(status.textContent).toMatch(/sync when you reconnect/i);
  });

  it("flips from hidden to visible when the offline event fires", () => {
    setOnline(true);
    const { container } = render(<OfflineBadge />);
    expect(container.firstChild).toBeNull();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("flips from visible to hidden when the online event fires", () => {
    setOnline(false);
    const { container } = render(<OfflineBadge />);
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(container.firstChild).toBeNull();
  });

  it("removes its window listeners on unmount", () => {
    setOnline(true);
    const { unmount, container } = render(<OfflineBadge />);
    unmount();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(container.firstChild).toBeNull();
  });
});
