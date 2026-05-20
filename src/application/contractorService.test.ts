import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/fieldlogDb";
import { inviteContractor } from "./contractorService";

const ORG = "org-test";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("inviteContractor", () => {
  it("creates an applicator and returns a stubbed invite token + link", async () => {
    const result = await inviteContractor({
      organizationId: ORG,
      applicatorName: " John Smith ",
      contractorCompanyName: " Smith Spray Services ",
      certificationNumber: " MO-123 ",
    });

    expect(result.applicator.applicatorName).toBe("John Smith");
    expect(result.applicator.contractorCompanyName).toBe("Smith Spray Services");
    expect(result.applicator.certificationNumber).toBe("MO-123");
    expect(result.inviteToken).toMatch(/^[0-9a-f-]+$/i);
    expect(result.inviteLink).toContain(result.inviteToken);
    expect(await db.applicators.count()).toBe(1);
  });

  it("normalizes an empty certification number to undefined", async () => {
    const { applicator } = await inviteContractor({
      organizationId: ORG,
      applicatorName: "Jane",
      contractorCompanyName: "Jane Co",
      certificationNumber: "   ",
    });
    expect(applicator.certificationNumber).toBeUndefined();
  });

  it("rejects an empty organizationId", async () => {
    await expect(
      inviteContractor({
        organizationId: "",
        applicatorName: "Jane",
        contractorCompanyName: "Jane Co",
      })
    ).rejects.toThrow(/organizationId/);
  });

  it("rejects an empty applicator name", async () => {
    await expect(
      inviteContractor({
        organizationId: ORG,
        applicatorName: "  ",
        contractorCompanyName: "Co",
      })
    ).rejects.toThrow(/Applicator name/);
  });

  it("rejects an empty company name", async () => {
    await expect(
      inviteContractor({
        organizationId: ORG,
        applicatorName: "Jane",
        contractorCompanyName: "  ",
      })
    ).rejects.toThrow(/company/i);
  });

  it("rejects a duplicate (same name + same company) within the same org", async () => {
    await inviteContractor({
      organizationId: ORG,
      applicatorName: "Jane",
      contractorCompanyName: "Jane Co",
    });
    await expect(
      inviteContractor({
        organizationId: ORG,
        applicatorName: "  jane  ",
        contractorCompanyName: "JANE CO",
      })
    ).rejects.toThrow(/already invited/);
    expect(await db.applicators.count()).toBe(1);
  });

  it("permits the same applicator across two organizations", async () => {
    await inviteContractor({
      organizationId: ORG,
      applicatorName: "Jane",
      contractorCompanyName: "Jane Co",
    });
    await inviteContractor({
      organizationId: "other-org",
      applicatorName: "Jane",
      contractorCompanyName: "Jane Co",
    });
    expect(await db.applicators.count()).toBe(2);
  });

  it("produces distinct invite tokens across two invites", async () => {
    const a = await inviteContractor({
      organizationId: ORG,
      applicatorName: "A",
      contractorCompanyName: "X",
    });
    const b = await inviteContractor({
      organizationId: ORG,
      applicatorName: "B",
      contractorCompanyName: "X",
    });
    expect(a.inviteToken).not.toBe(b.inviteToken);
  });
});
