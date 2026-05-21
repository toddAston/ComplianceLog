import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
import { ComplianceChecklistPanel } from "./ComplianceChecklistPanel";
import type {
  ComplianceCheckOutcome,
  ComplianceResultCode,
} from "../../application/complianceRules";

const mkOutcome = (
  overrides: Partial<ComplianceCheckOutcome> & {
    ruleId: string;
    resultCode: ComplianceResultCode;
    status: ComplianceCheckOutcome["status"];
  }
): ComplianceCheckOutcome => ({
  severity: "warning",
  message: "Message for " + overrides.ruleId,
  citation: "Full citation text.",
  citationShort: "2 CSR 70-25.120(X)",
  description: "desc",
  ...overrides,
});

describe("ComplianceChecklistPanel", () => {
  it("renders an all-clear state when no outcomes surface", () => {
    render(
      <ComplianceChecklistPanel
        outcomes={[
          mkOutcome({
            ruleId: "RULE_A",
            resultCode: "MISSING_REQUIRED_FIELD",
            status: "pass",
          }),
          mkOutcome({
            ruleId: "RULE_B",
            resultCode: "WARNING",
            status: "pass",
          }),
        ]}
      />
    );
    expect(screen.getByText(/all clear/i)).toBeTruthy();
    expect(
      screen.queryByTestId("compliance-bucket-MISSING_REQUIRED_FIELD")
    ).toBeNull();
    // The pass badge is still visible (count of 2 passing rules).
    expect(screen.getByText(/2 OK/i)).toBeTruthy();
  });

  it("groups failing checks into the matching resultCode bucket", () => {
    render(
      <ComplianceChecklistPanel
        outcomes={[
          mkOutcome({
            ruleId: "MISSING_FOO",
            resultCode: "MISSING_REQUIRED_FIELD",
            status: "fail",
            severity: "error",
            citationShort: "2 CSR 70-25.120(B)",
            message: "Foo is required.",
          }),
          mkOutcome({
            ruleId: "MISSING_BAR",
            resultCode: "MISSING_REQUIRED_FIELD",
            status: "fail",
            severity: "error",
            citationShort: "2 CSR 70-25.120(C)",
            message: "Bar is required.",
          }),
          mkOutcome({
            ruleId: "RECORD_LATE",
            resultCode: "WARNING",
            status: "fail",
            severity: "warning",
            citationShort: "2 CSR 70-25.120(1)",
            message: "Completed more than three business days after the application.",
          }),
        ]}
      />
    );
    const missingBucket = screen.getByTestId(
      "compliance-bucket-MISSING_REQUIRED_FIELD"
    );
    expect(within(missingBucket).getByText(/Foo is required/i)).toBeTruthy();
    expect(within(missingBucket).getByText(/Bar is required/i)).toBeTruthy();
    expect(
      within(missingBucket).getByText("2 CSR 70-25.120(B)")
    ).toBeTruthy();

    const warningBucket = screen.getByTestId("compliance-bucket-WARNING");
    expect(
      within(warningBucket).getByText(/three business days/i)
    ).toBeTruthy();
    expect(
      within(warningBucket).getByText("2 CSR 70-25.120(1)")
    ).toBeTruthy();
  });

  it("surfaces unknown-status LABEL_VERIFICATION_REQUIRED and NEEDS_REVIEW outcomes", () => {
    render(
      <ComplianceChecklistPanel
        outcomes={[
          mkOutcome({
            ruleId: "LABEL_RATE_NOT_REVIEWED",
            resultCode: "LABEL_VERIFICATION_REQUIRED",
            status: "unknown",
            citationShort: "FIFRA_LABELING",
            message: "Rate not yet reviewed against label.",
          }),
          mkOutcome({
            ruleId: "APPLICATOR_CATEGORY_UNKNOWN",
            resultCode: "NEEDS_REVIEW",
            status: "fail",
            citationShort: "2 CSR 70-25.120",
            message: "Applicator category unknown.",
          }),
        ]}
      />
    );
    expect(
      screen.getByTestId("compliance-bucket-LABEL_VERIFICATION_REQUIRED")
    ).toBeTruthy();
    expect(screen.getByTestId("compliance-bucket-NEEDS_REVIEW")).toBeTruthy();
    expect(screen.getByText("FIFRA_LABELING")).toBeTruthy();
  });

  it("does NOT surface unknown-status outcomes whose resultCode is not review-required", () => {
    render(
      <ComplianceChecklistPanel
        outcomes={[
          mkOutcome({
            ruleId: "RECORD_LATE",
            resultCode: "WARNING",
            status: "unknown",
            message: "Cannot compute timeliness.",
          }),
          mkOutcome({
            ruleId: "PESTICIDE_TYPE_UNKNOWN",
            resultCode: "LABEL_VERIFICATION_REQUIRED",
            status: "unknown",
            message: "RUP status unknown.",
          }),
        ]}
      />
    );
    // The plain WARNING `unknown` doesn't appear; the label-verification one does.
    expect(screen.queryByTestId("compliance-bucket-WARNING")).toBeNull();
    expect(
      screen.getByTestId("compliance-bucket-LABEL_VERIFICATION_REQUIRED")
    ).toBeTruthy();
  });

  it("renders missingFormFields in its own form-fields section above the buckets", () => {
    render(
      <ComplianceChecklistPanel
        outcomes={[]}
        missingFormFields={[
          "Missing required field: Product",
          "Missing required field: Target Pest",
        ]}
      />
    );
    const formSection = screen.getByTestId("compliance-form-fields");
    expect(
      within(formSection).getByText(/Missing required field: Product/i)
    ).toBeTruthy();
    expect(
      within(formSection).getByText(/Missing required field: Target Pest/i)
    ).toBeTruthy();
    // Not all-clear because there are surfaced items.
    expect(screen.queryByText(/all clear/i)).toBeNull();
  });

  it("shows bucket badges with their counts in the summary header", () => {
    render(
      <ComplianceChecklistPanel
        outcomes={[
          mkOutcome({
            ruleId: "A",
            resultCode: "MISSING_REQUIRED_FIELD",
            status: "fail",
          }),
          mkOutcome({
            ruleId: "B",
            resultCode: "MISSING_REQUIRED_FIELD",
            status: "fail",
          }),
          mkOutcome({
            ruleId: "C",
            resultCode: "MISSING_REQUIRED_FIELD",
            status: "fail",
          }),
          mkOutcome({
            ruleId: "D",
            resultCode: "WARNING",
            status: "fail",
          }),
        ]}
      />
    );
    expect(screen.getByText(/3 Missing required field/i)).toBeTruthy();
    expect(screen.getByText(/1 Warning/i)).toBeTruthy();
  });

  it("emits role=alert when there are surfaced issues, and no alert role when clear", () => {
    const { rerender } = render(
      <ComplianceChecklistPanel
        outcomes={[
          mkOutcome({
            ruleId: "RULE_A",
            resultCode: "MISSING_REQUIRED_FIELD",
            status: "pass",
          }),
        ]}
      />
    );
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(
      <ComplianceChecklistPanel
        outcomes={[
          mkOutcome({
            ruleId: "RULE_A",
            resultCode: "MISSING_REQUIRED_FIELD",
            status: "fail",
          }),
        ]}
      />
    );
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
