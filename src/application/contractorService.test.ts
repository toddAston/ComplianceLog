import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/fieldlogDb";
import { inviteContractor } from "./contractorService";

const ORG = "org-test";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  vi.unstubAllEnvs();
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

  it("defaults to window.origin when VITE_INVITE_BASE_URL is unset (clickable in dev)", async () => {
    vi.stubEnv("VITE_INVITE_BASE_URL", "");
    const result = await inviteContractor({
      organizationId: ORG,
      applicatorName: "Default",
      contractorCompanyName: "Co",
    });
    // jsdom sets window.location.origin to "http://localhost:3000" by
    // default. In any browser/test environment we get a clickable link.
    expect(result.inviteLink).toBe(
      `${window.location.origin}/invite/${result.inviteToken}`
    );
  });

  it("uses VITE_INVITE_BASE_URL + /invite/<token> when set", async () => {
    vi.stubEnv("VITE_INVITE_BASE_URL", "https://staging.fieldlog.app");
    const result = await inviteContractor({
      organizationId: ORG,
      applicatorName: "Override",
      contractorCompanyName: "Co",
    });
    expect(result.inviteLink).toBe(
      `https://staging.fieldlog.app/invite/${result.inviteToken}`
    );
  });

  it("strips trailing slashes from VITE_INVITE_BASE_URL", async () => {
    vi.stubEnv("VITE_INVITE_BASE_URL", "https://example.com/path//");
    const result = await inviteContractor({
      organizationId: ORG,
      applicatorName: "Trim",
      contractorCompanyName: "Co",
    });
    expect(result.inviteLink).toBe(
      `https://example.com/path/invite/${result.inviteToken}`
    );
    expect(result.inviteLink).not.toContain("//invite/");
  });

  it("falls back to window.origin when VITE_INVITE_BASE_URL is whitespace-only", async () => {
    vi.stubEnv("VITE_INVITE_BASE_URL", "   ");
    const result = await inviteContractor({
      organizationId: ORG,
      applicatorName: "Whitespace",
      contractorCompanyName: "Co",
    });
    expect(result.inviteLink).toBe(
      `${window.location.origin}/invite/${result.inviteToken}`
    );
  });

  it("produces a link that points at the /invite/:token route shape", async () => {
    const result = await inviteContractor({
      organizationId: ORG,
      applicatorName: "Route Shape",
      contractorCompanyName: "Co",
    });
    expect(result.inviteLink).toMatch(/\/invite\/[0-9a-f-]+$/i);
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
