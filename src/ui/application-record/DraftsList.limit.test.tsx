import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { db } from "../../db/fieldlogDb";
import { DEMO_ORG_ID, seedDemoData } from "../../db/seed";
import {
  createDraftApplicationRecord,
  type ActorContext,
} from "../../application/applicationRecordService";
import type { ContractorInputs } from "../../domain/types";
import { DraftsList } from "./DraftsList";

const ACTOR: ActorContext = {
  userId: "user-test-limit",
  displayName: "Test Limiter",
};

const baseInputs = (overrides: Partial<ContractorInputs> = {}): ContractorInputs => ({
  applicatorId: "applicator-john-smith",
  applicatorName: "John Smith",
  company: "Smith Spray Services",
  certificationNumber: "MO-123456",
  farmId: "farm-north",
  farmName: "North Farm",
  fieldId: "field-7",
  fieldName: "Field 7",
  cropOrSite: "Soybeans",
  acresTreated: "42.5",
  productId: "product-example-herbicide-4l",
  productName: "Example Herbicide 4L",
  epaRegistrationNumber: "12345-678",
  rupStatus: "no",
  catalogVersion: "MO-DEMO-2026-05-19",
  applicationDate: "2026-05-19",
  startTime: "08:00",
  endTime: "11:30",
  applicationMethod: "Ground broadcast",
  rateApplied: "1 qt/ac",
  totalAmountApplied: "10 gal",
  targetPest: "Waterhemp",
  temperature: "72F",
  windSpeed: "5 mph",
  windDirection: "S",
  attestationConfirmed: true,
  requesterName: "Acme Producer Co.",
  requesterAddress: "1234 Main St, Columbia, MO 65201",
  siteDescription: "North 40, soybean field along Highway B",
  applicatorCategory: "certified_commercial",
  slnNumber: "",
  ...overrides,
});

async function seedNDrafts(n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: baseInputs({ fieldName: `Field ${i + 1}` }),
      },
      ACTOR
    );
    ids.push(r.id);
  }
  return ids;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => cleanup());

describe("DraftsList — limit prop", () => {
  it("renders all records when no limit is provided", async () => {
    const ids = await seedNDrafts(7);
    render(<DraftsList />);
    // findBy on the newest blocks until the list has mounted, then verify all
    // 7 rows are present.
    await screen.findByTestId(`draft-row-${ids[ids.length - 1]}`);
    for (const id of ids) {
      expect(screen.getByTestId(`draft-row-${id}`)).toBeTruthy();
    }
  });

  it("caps the rendered row count at `limit`, keeping the newest records (useAllApplicationRecords sorts newest-first)", async () => {
    const ids = await seedNDrafts(7);
    const newest = ids[ids.length - 1];
    const oldest = ids[0];
    render(<DraftsList limit={3} />);

    // Newest must be visible so we know the list has mounted.
    await screen.findByTestId(`draft-row-${newest}`);
    // Oldest must be dropped by the cap.
    expect(screen.queryByTestId(`draft-row-${oldest}`)).toBeNull();
    // Exactly `limit` rows render.
    const rows = document.querySelectorAll('[data-testid^="draft-row-"]');
    expect(rows.length).toBe(3);
  });

  it("limit=0 hides every row and falls back to the empty-state copy", async () => {
    await seedNDrafts(4);
    render(<DraftsList limit={0} />);
    expect(await screen.findByText(/No records yet/i)).toBeTruthy();
    expect(document.querySelectorAll('[data-testid^="draft-row-"]').length).toBe(0);
  });

  it("limit larger than the record count renders every record without crashing", async () => {
    const ids = await seedNDrafts(2);
    render(<DraftsList limit={50} />);
    await screen.findByTestId(`draft-row-${ids[ids.length - 1]}`);
    for (const id of ids) {
      expect(screen.getByTestId(`draft-row-${id}`)).toBeTruthy();
    }
    const rows = document.querySelectorAll('[data-testid^="draft-row-"]');
    expect(rows.length).toBe(2);
  });
});
