import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegulationDialog } from "./RegulationDialog";

afterEach(() => cleanup());

describe("RegulationDialog", () => {
  it("renders nothing when citationShort is null", () => {
    render(<RegulationDialog citationShort={null} onClose={() => {}} />);
    expect(screen.queryByTestId("regulation-dialog")).toBeNull();
  });

  it("mounts an iframe pointing at the PDF with #page=N for a CSR citation", async () => {
    render(
      <RegulationDialog
        citationShort="2 CSR 70-25.120(D)"
        onClose={() => {}}
      />
    );
    const frame = await screen.findByTestId("regulation-pdf-frame");
    const src = frame.getAttribute("src") ?? "";
    expect(src).toContain("/missouri-2-csr-70-25.pdf");
    expect(src).toContain("#page=15");
  });

  it("uses page 3 for §.010 direct-supervision sub-citations", async () => {
    render(
      <RegulationDialog
        citationShort="2 CSR 70-25.010(3)(C)(7)"
        onClose={() => {}}
      />
    );
    const frame = await screen.findByTestId("regulation-pdf-frame");
    expect(frame.getAttribute("src")).toMatch(/#page=3$/);
  });

  it("uses page 8 for §.100 categories", async () => {
    render(
      <RegulationDialog
        citationShort="2 CSR 70-25.100"
        onClose={() => {}}
      />
    );
    const frame = await screen.findByTestId("regulation-pdf-frame");
    expect(frame.getAttribute("src")).toMatch(/#page=8$/);
  });

  it("uses page 16 for §.140 private-applicator categories", async () => {
    render(
      <RegulationDialog
        citationShort="2 CSR 70-25.140"
        onClose={() => {}}
      />
    );
    const frame = await screen.findByTestId("regulation-pdf-frame");
    expect(frame.getAttribute("src")).toMatch(/#page=16$/);
  });

  it("shows the non-PDF notice (no iframe) for an RSMo statute reference", async () => {
    render(
      <RegulationDialog citationShort="RSMo 281.035" onClose={() => {}} />
    );
    expect(
      await screen.findByTestId("regulation-dialog-non-pdf")
    ).toBeTruthy();
    expect(screen.queryByTestId("regulation-pdf-frame")).toBeNull();
    expect(screen.getByText(/External statute reference/i)).toBeTruthy();
  });

  it("shows the non-PDF notice for an internal FieldLog tag", async () => {
    render(
      <RegulationDialog
        citationShort="FIELDLOG_CHAIN_OF_CUSTODY"
        onClose={() => {}}
      />
    );
    expect(
      await screen.findByTestId("regulation-dialog-non-pdf")
    ).toBeTruthy();
    expect(screen.getByText(/Internal FieldLog tag/i)).toBeTruthy();
  });

  it("shows an 'unknown citation' notice for tags not in the registry", async () => {
    render(
      <RegulationDialog
        citationShort="not-a-real-citation"
        onClose={() => {}}
      />
    );
    expect(await screen.findByText(/Unknown citation/i)).toBeTruthy();
  });

  it("offers an 'Open in new tab' link for PDF-backed citations", async () => {
    render(
      <RegulationDialog
        citationShort="2 CSR 70-25.120(M)"
        onClose={() => {}}
      />
    );
    const link = await screen.findByTestId("regulation-dialog-open-tab");
    expect(link.getAttribute("href")).toMatch(
      /\/missouri-2-csr-70-25\.pdf#page=15$/
    );
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("Close button invokes onClose", async () => {
    const onClose = vi.fn();
    render(
      <RegulationDialog
        citationShort="2 CSR 70-25.120(A)"
        onClose={onClose}
      />
    );
    await userEvent.setup().click(
      await screen.findByTestId("regulation-dialog-close")
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
