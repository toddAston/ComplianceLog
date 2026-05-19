import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "../../App";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";
import { DraftApplicationRecordForm } from "./DraftApplicationRecordForm";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

async function fillValidDraft() {
  await screen.findByRole("option", {
    name: /John Smith.*Smith Spray Services/,
  });

  fireEvent.change(screen.getByLabelText("Organization"), {
    target: { value: "org-demo-semofarms" },
  });
  fireEvent.change(screen.getByLabelText("Applicator"), {
    target: { value: "applicator-john-smith" },
  });
  fireEvent.change(screen.getByLabelText("Farm"), {
    target: { value: "farm-north" },
  });
  fireEvent.change(screen.getByLabelText("Field"), {
    target: { value: "field-7" },
  });
  fireEvent.change(screen.getByLabelText("Product"), {
    target: { value: "product-example-herbicide-4l" },
  });

  fireEvent.change(screen.getByLabelText("Crop or site"), {
    target: { value: "Soybeans" },
  });
  fireEvent.change(screen.getByLabelText("Acres treated"), {
    target: { value: "42.5" },
  });

  fireEvent.change(screen.getByLabelText("Application date"), {
    target: { value: "2026-05-19" },
  });
  fireEvent.change(screen.getByLabelText("Start time"), {
    target: { value: "08:00" },
  });
  fireEvent.change(screen.getByLabelText("Application method"), {
    target: { value: "Ground broadcast" },
  });
  fireEvent.change(screen.getByLabelText("Rate applied"), {
    target: { value: "1 qt/ac" },
  });
  fireEvent.change(screen.getByLabelText("Total amount applied"), {
    target: { value: "10 gal" },
  });

  fireEvent.change(screen.getByLabelText("Temperature"), {
    target: { value: "72F" },
  });
  fireEvent.change(screen.getByLabelText("Wind speed"), {
    target: { value: "5 mph" },
  });
  fireEvent.change(screen.getByLabelText("Wind direction"), {
    target: { value: "S" },
  });
}

describe("DraftApplicationRecordForm", () => {
  it("populates dropdowns from seeded reference data", async () => {
    render(<DraftApplicationRecordForm />);

    expect(
      await screen.findByRole("option", {
        name: "Southeast Missouri Farms Demo",
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("option", {
        name: /John Smith.*Smith Spray Services/,
      })
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "North Farm" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Field 7" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /Example Herbicide 4L/ })
    ).toBeTruthy();
  });

  it("shows validation messages on empty submit and writes nothing", async () => {
    render(<DraftApplicationRecordForm />);

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(
      await screen.findByText(/Organization is required/i)
    ).toBeTruthy();
    expect(screen.getByText(/Applicator is required/i)).toBeTruthy();
    expect(screen.getByText(/Farm is required/i)).toBeTruthy();
    expect(screen.getByText(/Field is required/i)).toBeTruthy();
    expect(screen.getByText(/Product is required/i)).toBeTruthy();

    expect(await db.applicationRecords.count()).toBe(0);
  });

  it("creates a draft via the application service when valid inputs are submitted", async () => {
    render(<DraftApplicationRecordForm />);

    await fillValidDraft();

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });

    const records = await db.applicationRecords.toArray();
    expect(records[0].workflowStatus).toBe("draft");
    expect(records[0].syncStatus).toBe("local_only");
    expect(records[0].contractorInputs.applicatorName).toBe("John Smith");
    expect(records[0].contractorInputs.company).toBe("Smith Spray Services");
    expect(records[0].contractorInputs.farmName).toBe("North Farm");
    expect(records[0].contractorInputs.fieldName).toBe("Field 7");
    expect(records[0].contractorInputs.productName).toBe(
      "Example Herbicide 4L"
    );
    expect(records[0].contractorInputs.epaRegistrationNumber).toBe("12345-678");

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(records[0].id)
      .toArray();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("created");
    expect(events[0].actorUserId).toBe("user-demo-applicator");
    expect(events[0].actorDisplayName).toBe("Demo Applicator");
  });
});

describe("App + DraftApplicationRecordForm integration", () => {
  it("new draft appears in the Drafts list after save", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 2, name: /Drafts \(0\)/ })
    ).toBeTruthy();

    await fillValidDraft();

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(
      await screen.findByRole("heading", { level: 2, name: /Drafts \(1\)/ })
    ).toBeTruthy();
    expect(await screen.findByText("draft")).toBeTruthy();
    expect(await screen.findByText("local_only")).toBeTruthy();
  });

  it("submitted draft persists across a remount (refresh)", async () => {
    const first = render(<App />);

    await fillValidDraft();
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await screen.findByRole("heading", { level: 2, name: /Drafts \(1\)/ });

    first.unmount();

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 2, name: /Drafts \(1\)/ })
    ).toBeTruthy();
    expect(await screen.findByText("draft")).toBeTruthy();
    expect(await screen.findByText("local_only")).toBeTruthy();
  });
});
