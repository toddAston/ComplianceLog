import { describe, expect, it } from "vitest";
import { fieldlogTheme } from "./theme";

function sRgbChannel(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (
    0.2126 * sRgbChannel(r) +
    0.7152 * sRgbChannel(g) +
    0.0722 * sRgbChannel(b)
  );
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

describe("fieldlogTheme", () => {
  it("uses the FieldLog brand green as the primary color", () => {
    expect(fieldlogTheme.palette.primary.main).toBe("#2e7d32");
  });

  it("has a 16px base font size for readability on small phones", () => {
    expect(fieldlogTheme.typography.fontSize).toBe(16);
  });

  it("enforces a 44px minimum touch target on buttons and inputs", () => {
    const buttonRoot = fieldlogTheme.components?.MuiButton?.styleOverrides
      ?.root as { minHeight?: number } | undefined;
    expect(buttonRoot?.minHeight).toBe(44);

    const inputRoot = fieldlogTheme.components?.MuiInputBase?.styleOverrides
      ?.root as { minHeight?: number } | undefined;
    expect(inputRoot?.minHeight).toBe(44);
  });

  it("defaults TextField to fullWidth outlined for mobile-friendly forms", () => {
    const defaults = fieldlogTheme.components?.MuiTextField?.defaultProps as
      | { fullWidth?: boolean; variant?: string }
      | undefined;
    expect(defaults?.fullWidth).toBe(true);
    expect(defaults?.variant).toBe("outlined");
  });

  it("disables text-transform on buttons so labels stay sentence case", () => {
    expect(fieldlogTheme.typography.button?.textTransform).toBe("none");
  });
});

describe("fieldlogTheme contrast (WCAG AA)", () => {
  const palette = fieldlogTheme.palette;
  const bgDefault = palette.background.default;
  const bgPaper = palette.background.paper;

  it("text.primary meets AA on both background surfaces", () => {
    expect(
      contrastRatio(palette.text.primary, bgDefault)
    ).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(
      contrastRatio(palette.text.primary, bgPaper)
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("text.secondary meets AA on both background surfaces", () => {
    expect(
      contrastRatio(palette.text.secondary, bgDefault)
    ).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(
      contrastRatio(palette.text.secondary, bgPaper)
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("text.disabled meets AA Large (used only for non-essential / disabled UI)", () => {
    expect(
      contrastRatio(palette.text.disabled, bgDefault)
    ).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("primary button text meets AA on primary.main", () => {
    expect(
      contrastRatio(palette.primary.contrastText, palette.primary.main)
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("error / warning / success contrastText meet AA on their fills", () => {
    expect(
      contrastRatio(palette.error.contrastText, palette.error.main)
    ).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(
      contrastRatio(palette.warning.contrastText, palette.warning.main)
    ).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(
      contrastRatio(palette.success.contrastText, palette.success.main)
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("contrast computation sanity: black on white is ~21, white on white is ~1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});
