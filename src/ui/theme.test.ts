import { describe, expect, it } from "vitest";
import { fieldlogTheme } from "./theme";

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
