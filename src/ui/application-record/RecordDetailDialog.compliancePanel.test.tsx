import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { db } from "../../db/fieldlogDb";
import { seedDemoData, DEMO_ORG_ID } from "../../db/seed";
import type { ApplicationRecord, ContractorInputs } from "../../domain/types";
import { RecordDetailDialog } from "./RecordDetailDialog";

// The global test setup (src/test/setup.ts) only wires fake-indexeddb; it does
// NOT register Testing Library cleanup. See ComplianceChecklistPanel.test.tsx
// for the same afterEach pattern used by sibling tests.
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

// A contractor-inputs fixture that fills every field the engine treats as
// required AND every optional matrix field whose absence would surface a
// LABEL_VERIFICATION_REQUIRED / NEEDS_REVIEW bucket. The point is to give us a
// truly "all clear" baseline against which we can flip a single field per test
// and assert exactly one bucket appears.
const buildCompliantContractorInputs = (
  overrides: Partial<ContractorInputs> = {}
): ContractorInputs => ({
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

  // Label-verification acknowledgments — each LABEL_VERIFICATION_REQUIRED rule
  // sits at `unknown` until the operator flags review. Set every ack so the
  // panel reports all-clear.
  productLabelRef: "label-cabinet/example-herbicide-4l.pdf",
  labelVersionOrDate: "2026-04-01",
  labelConsistencyReviewed: true,
  labelCropSiteReviewed: true,
  labelTargetPestReviewed: true,
  labelRateReviewed: true,
  labelTimingMethodReviewed: true,
  labelPpeReviewed: true,
  labelReiPhiReviewed: true,
  labelDriftBufferReviewed: true,

  // Evidence-quality rules (NEEDS_REVIEW) — outdoor records flag these absent.
  weatherCaptureSource: "on-site meter",
  weatherCaptureTimestamp: "2026-05-19T08:15:00.000Z",
  weatherCaptureLocation: "Field 7 NE corner",
  gpsLatitude: "37.2",
  gpsLongitude: "-89.7",

  ...overrides,
});

function buildRecord(
  ciOverrides: Partial<ContractorInputs> = {}
): ApplicationRecord {
  const now = new Date().toISOString();
  return {
    id: "record-test-1",
    organizationId: DEMO_ORG_ID,
    workflowStatus: "draft",
    syncStatus: "local_only",
    contractorInputs: buildCompliantContractorInputs(ciOverrides),
    managerInputs: { reviewStatus: "not_reviewed" },
    system: {
      createdAt: now,
      createdOffline: false,
      lastUpdatedAt: now,
    },
    complianceReviewRequired: false,
  };
}

describe("RecordDetailDialog compliance panel integration", () => {
  it("mounts the panel inside the dialog and shows an all-clear state for a fully-compliant record", () => {
    const record = buildRecord();
    render(<RecordDetailDialog record={record} onClose={() => undefined} />);

    const panel = screen.getByTestId("compliance-checklist-panel");
    expect(panel).toBeTruthy();

    // The dialog never forwards `missingFormFields`, so that section must not
    // render regardless of state — every signal here comes from outcomes.
    expect(within(panel).queryByTestId("compliance-form-fields")).toBeNull();

    // No bucket sections are present when everything passes.
    expect(
      within(panel).queryByTestId("compliance-bucket-MISSING_REQUIRED_FIELD")
    ).toBeNull();
    expect(
      within(panel).queryByTestId("compliance-bucket-BLOCKED_BY_EXPLICIT_RULE")
    ).toBeNull();
    expect(
      within(panel).queryByTestId("compliance-bucket-WARNING")
    ).toBeNull();
    expect(
      within(panel).queryByTestId("compliance-bucket-NEEDS_REVIEW")
    ).toBeNull();
    expect(
      within(panel).queryByTestId(
        "compliance-bucket-LABEL_VERIFICATION_REQUIRED"
      )
    ).toBeNull();

    // The header swaps to "✓ Missouri compliance checks — all clear" when
    // nothing is surfaced.
    expect(within(panel).getByText(/all clear/i)).toBeTruthy();
  });

  it("renders a MISSING_REQUIRED_FIELD bucket with the 2 CSR 70-25.120(H) citation when target pest is empty", () => {
    const record = buildRecord({ targetPest: "" });
    render(<RecordDetailDialog record={record} onClose={() => undefined} />);

    const panel = screen.getByTestId("compliance-checklist-panel");
    const bucket = within(panel).getByTestId(
      "compliance-bucket-MISSING_REQUIRED_FIELD"
    );
    expect(bucket).toBeTruthy();

    // MISSING_TARGET_PEST is the only rule that should now fail; it carries the
    // (H) citation and its rule id is rendered inside the bucket entry.
    expect(within(bucket).getByText(/MISSING_TARGET_PEST/)).toBeTruthy();
    expect(within(bucket).getByText("2 CSR 70-25.120(H)")).toBeTruthy();

    // All-clear text is gone whenever any bucket renders.
    expect(within(panel).queryByText(/all clear/i)).toBeNull();
  });

  it("surfaces APPLICATOR_CATEGORY_UNKNOWN into the NEEDS_REVIEW bucket when applicator category is empty", () => {
    // Casting through Partial<ContractorInputs> — the zod schema types the
    // category as an enum; here we explicitly clear it to simulate a legacy
    // record whose category was never classified. The rule reads
    // `applicatorCategory` defensively and treats "" as fail.
    const record = buildRecord({
      applicatorCategory: undefined,
    });
    render(<RecordDetailDialog record={record} onClose={() => undefined} />);

    const panel = screen.getByTestId("compliance-checklist-panel");
    const bucket = within(panel).getByTestId(
      "compliance-bucket-NEEDS_REVIEW"
    );
    expect(bucket).toBeTruthy();

    // The category-unknown rule carries citationShort "2 CSR 70-25.120" and
    // resultCode NEEDS_REVIEW (status `fail`).
    expect(within(bucket).getByText(/APPLICATOR_CATEGORY_UNKNOWN/)).toBeTruthy();
    expect(within(bucket).getByText("2 CSR 70-25.120")).toBeTruthy();
  });

  it("does NOT mount the compliance panel when the dialog has no record", () => {
    const { container } = render(
      <RecordDetailDialog record={null} onClose={() => undefined} />
    );

    // RecordDetailDialog returns null on a null record; nothing — including
    // the panel — should render.
    expect(container.querySelector('[data-testid="compliance-checklist-panel"]')).toBeNull();
  });
});
