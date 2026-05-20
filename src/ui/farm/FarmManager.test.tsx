import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../../db/fieldlogDb";
import { FarmManager } from "./FarmManager";

const ORG = "org-test";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  cleanup();
});

describe("FarmManager", () => {
  it("shows an empty-state message when no farms exist", async () => {
    render(<FarmManager organizationId={ORG} />);
    expect(await screen.findByTestId("farm-list-empty")).toBeTruthy();
  });

  it("creates a farm via the form and clears the input", async () => {
    const user = userEvent.setup();
    render(<FarmManager organizationId={ORG} />);

    await user.type(screen.getByLabelText("Farm name"), "North Farm");
    await user.click(screen.getByRole("button", { name: /create farm/i }));

    await waitFor(async () => {
      expect(await db.farms.count()).toBe(1);
    });
    expect(
      (screen.getByLabelText("Farm name") as HTMLInputElement).value
    ).toBe("");
    expect(await screen.findByText(/North Farm/)).toBeTruthy();
  });

  it("disables Create when the input is empty or whitespace", async () => {
    const user = userEvent.setup();
    render(<FarmManager organizationId={ORG} />);

    const button = screen.getByRole("button", { name: /create farm/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Farm name"), "   ");
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Farm name"), "Anything");
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("surfaces an inline error when creating a duplicate farm name", async () => {
    const user = userEvent.setup();
    render(<FarmManager organizationId={ORG} />);

    await user.type(screen.getByLabelText("Farm name"), "North");
    await user.click(screen.getByRole("button", { name: /create farm/i }));
    await waitFor(async () => expect(await db.farms.count()).toBe(1));

    await user.type(screen.getByLabelText("Farm name"), "north");
    await user.click(screen.getByRole("button", { name: /create farm/i }));

    expect(await screen.findByText(/already exists/i)).toBeTruthy();
    expect(await db.farms.count()).toBe(1);
  });

  it("does not leak the raw farm id into the farm row UI", async () => {
    await db.farms.add({
      id: "farm-debug-xyz",
      organizationId: ORG,
      name: "Visible Farm",
      createdAt: new Date().toISOString(),
    });
    render(<FarmManager organizationId={ORG} />);

    expect(await screen.findByText("Visible Farm")).toBeTruthy();
    expect(screen.queryByText(/^id:/)).toBeNull();
    expect(screen.queryByText(/farm-debug-xyz/)).toBeNull();
  });

  it("only lists farms for the active organization", async () => {
    await db.farms.bulkAdd([
      {
        id: "f-1",
        organizationId: ORG,
        name: "Mine",
        createdAt: new Date().toISOString(),
      },
      {
        id: "f-2",
        organizationId: "other-org",
        name: "Theirs",
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<FarmManager organizationId={ORG} />);

    expect(await screen.findByText("Mine")).toBeTruthy();
    expect(screen.queryByText("Theirs")).toBeNull();
  });

  it("renames a farm inline and persists the new name", async () => {
    const user = userEvent.setup();
    await db.farms.add({
      id: "f-1",
      organizationId: ORG,
      name: "North",
      createdAt: new Date().toISOString(),
    });
    render(<FarmManager organizationId={ORG} />);

    await user.click(await screen.findByRole("button", { name: /rename/i }));
    const input = await screen.findByLabelText("Rename North");
    await user.clear(input);
    await user.type(input, "North Farm");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("North Farm")).toBeTruthy();
    expect((await db.farms.get("f-1"))?.name).toBe("North Farm");
  });

  it("cancels a rename without persisting the draft", async () => {
    const user = userEvent.setup();
    await db.farms.add({
      id: "f-1",
      organizationId: ORG,
      name: "North",
      createdAt: new Date().toISOString(),
    });
    render(<FarmManager organizationId={ORG} />);

    await user.click(await screen.findByRole("button", { name: /rename/i }));
    const input = await screen.findByLabelText("Rename North");
    await user.clear(input);
    await user.type(input, "Throwaway");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect((await db.farms.get("f-1"))?.name).toBe("North");
    expect(await screen.findByText("North")).toBeTruthy();
  });

  it("surfaces an inline rename error when the new name collides", async () => {
    const user = userEvent.setup();
    await db.farms.bulkAdd([
      {
        id: "f-1",
        organizationId: ORG,
        name: "North",
        createdAt: new Date().toISOString(),
      },
      {
        id: "f-2",
        organizationId: ORG,
        name: "South",
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<FarmManager organizationId={ORG} />);

    const northRow = await screen.findByTestId("farm-row-f-1");
    await user.click(
      within(northRow).getByRole("button", { name: /rename/i })
    );
    const input = await screen.findByLabelText("Rename North");
    await user.clear(input);
    await user.type(input, "South");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/already exists/i)).toBeTruthy();
    expect((await db.farms.get("f-1"))?.name).toBe("North");
  });
});
