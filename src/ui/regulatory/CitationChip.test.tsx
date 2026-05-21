import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CitationChip } from "./CitationChip";

afterEach(() => cleanup());

describe("CitationChip", () => {
  it("renders as a clickable button for a PDF-backed CSR citation", async () => {
    const onOpen = vi.fn();
    render(
      <CitationChip citationShort="2 CSR 70-25.120(D)" onOpen={onOpen} />
    );
    const chip = screen.getByTestId("citation-chip-2 CSR 70-25.120(D)");
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.getAttribute("data-citation-clickable")).toBe("true");

    await userEvent.setup().click(chip);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("2 CSR 70-25.120(D)");
  });

  it("renders as a non-clickable code span for an RSMo statute reference", async () => {
    const onOpen = vi.fn();
    render(<CitationChip citationShort="RSMo 281.035" onOpen={onOpen} />);
    const chip = screen.getByTestId("citation-chip-RSMo 281.035");
    expect(chip.tagName).toBe("CODE");
    expect(chip.getAttribute("data-citation-clickable")).toBe("false");

    await userEvent.setup().click(chip);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders as non-clickable for internal FieldLog source tags", () => {
    for (const tag of [
      "FIFRA_LABELING",
      "FIELDLOG_CHAIN_OF_CUSTODY",
      "FIELDLOG_OPERATIONAL",
    ]) {
      const onOpen = vi.fn();
      render(<CitationChip citationShort={tag} onOpen={onOpen} />);
      const chip = screen.getByTestId(`citation-chip-${tag}`);
      expect(chip.getAttribute("data-citation-clickable")).toBe("false");
      cleanup();
    }
  });

  it("renders unknown citation strings as non-clickable with a fallback tooltip", () => {
    render(<CitationChip citationShort="not-a-citation" />);
    const chip = screen.getByTestId("citation-chip-not-a-citation");
    expect(chip.getAttribute("data-citation-clickable")).toBe("false");
    expect(chip.getAttribute("title")).toMatch(/Citation: not-a-citation/);
  });

  it("renders as non-clickable when onOpen is omitted, even for PDF-backed citations", () => {
    render(<CitationChip citationShort="2 CSR 70-25.120(D)" />);
    const chip = screen.getByTestId("citation-chip-2 CSR 70-25.120(D)");
    expect(chip.getAttribute("data-citation-clickable")).toBe("false");
  });

  it("stops propagation so a parent row-click handler doesn't also fire", async () => {
    const onOpen = vi.fn();
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <CitationChip
          citationShort="2 CSR 70-25.120(D)"
          onOpen={onOpen}
        />
      </div>
    );
    await userEvent.setup().click(
      screen.getByTestId("citation-chip-2 CSR 70-25.120(D)")
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
  });
});
