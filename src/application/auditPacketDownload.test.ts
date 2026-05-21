import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/fieldlogDb";
import { DEMO_ORG_ID, seedDemoData } from "../db/seed";
import {
  acceptAndLockApplicationRecord,
  createDraftApplicationRecord,
  submitApplicationRecord,
  type ActorContext,
} from "./applicationRecordService";
import {
  downloadAuditPacketJson,
  downloadAuditPacketPdf,
} from "./auditPacketDownload";
import type { ContractorInputs } from "../domain/types";

const TEST_APPLICATOR: ActorContext = {
  userId: "user-test-applicator",
  displayName: "Test Applicator",
};

const TEST_MANAGER: ActorContext = {
  userId: "user-test-manager",
  displayName: "Test Manager",
};

const buildContractorInputs = (): ContractorInputs => ({
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
});

async function seedLockedRecord() {
  const draft = await createDraftApplicationRecord(
    { organizationId: DEMO_ORG_ID, contractorInputs: buildContractorInputs() },
    TEST_APPLICATOR
  );
  await submitApplicationRecord(draft.id, TEST_APPLICATOR);
  return acceptAndLockApplicationRecord(draft.id, TEST_MANAGER, "Looks good.");
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

describe("downloadAuditPacketJson", () => {
  it("triggers a download whose blob contains the full export DTO and the matrix disclaimer", async () => {
    const locked = await seedLockedRecord();
    const captured: Array<{ blob: Blob; fileName: string }> = [];

    await downloadAuditPacketJson(locked.id, {
      triggerDownload: (blob, fileName) => captured.push({ blob, fileName }),
    });

    expect(captured.length).toBe(1);
    expect(captured[0].fileName).toBe(`application-record-${locked.id}.json`);
    expect(captured[0].blob.type).toBe("application/json");

    const text = await captured[0].blob.text();
    const dto = JSON.parse(text);
    expect(dto.recordId).toBe(locked.id);
    expect(dto.workflowStatus).toBe("locked");
    expect(dto.retainUntil).toBe("2029-05-19");
    expect(Array.isArray(dto.complianceChecklist)).toBe(true);
    expect(dto.disclaimer).toMatch(/qualified human review/i);
    expect(dto.events.length).toBeGreaterThan(0);
  });

  it("rejects unknown record ids without firing a download", async () => {
    const captured: unknown[] = [];
    await expect(
      downloadAuditPacketJson("does-not-exist", {
        triggerDownload: (blob, fileName) =>
          captured.push({ blob, fileName }),
      })
    ).rejects.toThrow(/not found/i);
    expect(captured.length).toBe(0);
  });

  it("rejects draft and pending_review records (only locked records export)", async () => {
    const draft = await createDraftApplicationRecord(
      {
        organizationId: DEMO_ORG_ID,
        contractorInputs: buildContractorInputs(),
      },
      TEST_APPLICATOR
    );
    await expect(
      downloadAuditPacketJson(draft.id, { triggerDownload: () => {} })
    ).rejects.toThrow(/locked/i);

    await submitApplicationRecord(draft.id, TEST_APPLICATOR);
    await expect(
      downloadAuditPacketJson(draft.id, { triggerDownload: () => {} })
    ).rejects.toThrow(/locked/i);
  });
});

describe("downloadAuditPacketPdf", () => {
  it("triggers a PDF download with a non-empty blob and a record-scoped filename", async () => {
    const locked = await seedLockedRecord();
    const captured: Array<{ blob: Blob; fileName: string }> = [];

    await downloadAuditPacketPdf(locked.id, {
      triggerDownload: (blob, fileName) => captured.push({ blob, fileName }),
    });

    expect(captured.length).toBe(1);
    expect(captured[0].fileName).toBe(`application-record-${locked.id}.pdf`);
    expect(captured[0].blob.size).toBeGreaterThan(0);
  });

  it("rejects unknown record ids without firing a download", async () => {
    const captured: unknown[] = [];
    await expect(
      downloadAuditPacketPdf("does-not-exist", {
        triggerDownload: (blob, fileName) =>
          captured.push({ blob, fileName }),
      })
    ).rejects.toThrow(/not found/i);
    expect(captured.length).toBe(0);
  });
});

describe("triggerDownload (default implementation)", () => {
  it("creates an <a download>, clicks it, and removes it from the DOM", async () => {
    const locked = await seedLockedRecord();

    // Stub URL.createObjectURL / revokeObjectURL — jsdom provides these but
    // they're noops; capturing them confirms the download path was exercised.
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const created: string[] = [];
    const revoked: string[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      const url = `blob:test/${(b as Blob).size}`;
      created.push(url);
      return url;
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    }) as unknown as typeof URL.revokeObjectURL;

    // Spy on click to make sure the <a> is actually clicked.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    try {
      await downloadAuditPacketJson(locked.id);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(created.length).toBe(1);
      // revoke is queued on setTimeout(0); wait a tick.
      await new Promise((r) => setTimeout(r, 5));
      expect(revoked).toEqual(created);
      // The <a> should not remain in the DOM after the click.
      const leftovers = document.body.querySelectorAll("a[download]");
      expect(leftovers.length).toBe(0);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
