import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../../db/fieldlogDb";
import { ContractorManager } from "./ContractorManager";

const ORG = "org-test";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  cleanup();
});

describe("ContractorManager", () => {
  it("shows the empty state when no contractors exist", async () => {
    render(<ContractorManager organizationId={ORG} />);
    expect(
      await screen.findByTestId("contractor-list-empty")
    ).toBeTruthy();
  });

  it("disables the submit button until name and company are present", async () => {
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    const button = screen.getByRole("button", { name: /send invite/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Applicator name"), "Jane");
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await user.type(
      screen.getByLabelText("Contractor company"),
      "Jane Co"
    );
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("creates an applicator and shows a stubbed invite link", async () => {
    const user = userEvent.setup();
    render(<ContractorManager organizationId={ORG} />);

    await user.type(screen.getByLabelText("Applicator name"), "Jane Doe");
    await user.type(
      screen.getByLabelText("Contractor company"),
      "Doe Spraying"
    );
    await user.type(
      screen.getByLabelText("Certification number"),
      "MO-77"
    );
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    const link = await screen.findByTestId("invite-link");
    expect(link.textContent).toMatch(/^https:\/\/fieldlog\.invite\//);
    await waitFor(async () => expect(await db.applicators.count()).toBe(1));
    const [a] = await db.applicators.toArray();
    expect(a.applicatorName).toBe("Jane Doe");
    expect(a.contractorCompanyName).toBe("Doe Spraying");
    expect(a.certificationNumber).toBe("MO-77");
  });

  it("surfaces a duplicate invite as an inline error", async () => {
    const user = userEvent.setup();
    await db.applicators.add({
      id: "a-1",
      organizationId: ORG,
      applicatorName: "Jane",
      contractorCompanyName: "Jane Co",
      createdAt: new Date().toISOString(),
    });
    render(<ContractorManager organizationId={ORG} />);

    await user.type(screen.getByLabelText("Applicator name"), "jane");
    await user.type(
      screen.getByLabelText("Contractor company"),
      "JANE CO"
    );
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    const err = await screen.findByTestId("invite-error");
    expect(err.textContent).toMatch(/already invited/i);
    expect(await db.applicators.count()).toBe(1);
  });

  it("only lists contractors for its own organization", async () => {
    await db.applicators.bulkAdd([
      {
        id: "mine",
        organizationId: ORG,
        applicatorName: "Mine",
        contractorCompanyName: "Mine Co",
        createdAt: new Date().toISOString(),
      },
      {
        id: "theirs",
        organizationId: "other-org",
        applicatorName: "Theirs",
        contractorCompanyName: "Theirs Co",
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<ContractorManager organizationId={ORG} />);

    expect(await screen.findByText(/Mine/)).toBeTruthy();
    expect(screen.queryByText(/Theirs/)).toBeNull();
  });

  it("renders the certification number when present", async () => {
    await db.applicators.add({
      id: "a-cert",
      organizationId: ORG,
      applicatorName: "Cert Holder",
      contractorCompanyName: "Cert Co",
      certificationNumber: "MO-999",
      createdAt: new Date().toISOString(),
    });
    render(<ContractorManager organizationId={ORG} />);

    expect(await screen.findByText(/cert # MO-999/)).toBeTruthy();
  });
});
