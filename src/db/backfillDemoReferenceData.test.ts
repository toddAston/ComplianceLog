import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./fieldlogDb";
import { DEMO_ORG_ID, seedDemoData } from "./seed";
import {
  DEMO_APPLICATORS,
  DEMO_FARMS,
  DEMO_FIELDS,
} from "./seedDemoRecords";
import { backfillDemoReferenceData } from "./backfillDemoReferenceData";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("backfillDemoReferenceData boot heal", () => {
  it("adds missing demo farms, fields, and applicators on a stale-but-seeded DB", async () => {
    // Simulate a stale state where the user's IndexedDB was seeded under an
    // OLDER version of the demo (just one farm / field / applicator) and the
    // org guard would skip seedDemoData on the next boot. Pre-populate the
    // org + a SINGLE legacy applicator/farm/field, then run the backfill.
    await db.organizations.add({
      id: DEMO_ORG_ID,
      name: "Southeast Missouri Farms Demo",
      createdAt: new Date().toISOString(),
    });
    await db.farms.add({
      id: "farm-north",
      organizationId: DEMO_ORG_ID,
      name: "North Farm",
      createdAt: new Date().toISOString(),
    });
    await db.applicators.add({
      id: "applicator-john-smith",
      organizationId: DEMO_ORG_ID,
      contractorCompanyName: "Smith Spray Services",
      applicatorName: "John Smith",
      certificationNumber: "MO-123456",
      createdAt: new Date().toISOString(),
    });
    expect(await db.farms.count()).toBe(1);
    expect(await db.applicators.count()).toBe(1);

    const result = await backfillDemoReferenceData();
    expect(result.farms).toBe(DEMO_FARMS.length - 1);
    expect(result.applicators).toBe(DEMO_APPLICATORS.length - 1);
    expect(result.fields).toBe(DEMO_FIELDS.length);

    expect(await db.farms.count()).toBe(DEMO_FARMS.length);
    expect(await db.fields.count()).toBe(DEMO_FIELDS.length);
    expect(await db.applicators.count()).toBe(DEMO_APPLICATORS.length);
  });

  it("is a no-op when every demo row is already present", async () => {
    await seedDemoData();
    const result = await backfillDemoReferenceData();
    expect(result).toEqual({ farms: 0, fields: 0, applicators: 0 });
  });

  it("never overwrites a user-added row that shares the same id", async () => {
    await seedDemoData();
    // Simulate: a user-edited applicator name on the seeded row.
    await db.applicators.update("applicator-john-smith", {
      applicatorName: "John Smith (edited)",
    });
    await backfillDemoReferenceData();
    const after = await db.applicators.get("applicator-john-smith");
    expect(after?.applicatorName).toBe("John Smith (edited)");
  });

  it("leaves rows the user added through the UI intact", async () => {
    await seedDemoData();
    // Simulate: a manager invited a new contractor through ContractorManager.
    await db.applicators.add({
      id: "applicator-user-invited-001",
      organizationId: DEMO_ORG_ID,
      contractorCompanyName: "User Added LLC",
      applicatorName: "User Added Applicator",
      createdAt: new Date().toISOString(),
    });
    await backfillDemoReferenceData();
    const userAdded = await db.applicators.get("applicator-user-invited-001");
    expect(userAdded?.applicatorName).toBe("User Added Applicator");
  });
});
