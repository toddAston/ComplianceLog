import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SyncStatusChip } from "./SyncStatusChip";

afterEach(() => cleanup());

describe("SyncStatusChip", () => {
  it("renders a human label per status", () => {
    render(<SyncStatusChip status="local_only" />);
    expect(screen.getByText("Local only")).toBeTruthy();
    cleanup();
    render(<SyncStatusChip status="queued" />);
    expect(screen.getByText("Queued")).toBeTruthy();
    cleanup();
    render(<SyncStatusChip status="syncing" />);
    expect(screen.getByText(/Syncing/)).toBeTruthy();
    cleanup();
    render(<SyncStatusChip status="synced" />);
    expect(screen.getByText("Synced")).toBeTruthy();
    cleanup();
    render(<SyncStatusChip status="sync_failed" />);
    expect(screen.getByText("Sync failed")).toBeTruthy();
  });

  it("uses recordId in the testid when provided so per-row chips are addressable", () => {
    render(<SyncStatusChip status="queued" recordId="rec-42" />);
    expect(screen.getByTestId("sync-chip-rec-42")).toBeTruthy();
  });

  it("falls back to status-named testid when no recordId is given", () => {
    render(<SyncStatusChip status="local_only" />);
    expect(screen.getByTestId("sync-chip-local_only")).toBeTruthy();
  });
});
