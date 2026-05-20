import { createTheme } from "@mui/material/styles";

export const fieldlogTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2e7d32", contrastText: "#ffffff" },
    secondary: { main: "#F57C00" },
    background: { default: "#FAFAFA", paper: "#f5f5f5" },
    error: { main: "#d32f2f", contrastText: "#ffffff" },
    warning: { main: "#F59E0B", contrastText: "#1f2937" },
    success: { main: "#15803d", contrastText: "#ffffff" },
    text: {
      primary: "#212121",
      secondary: "#646464",
      disabled: "#737373",
    },
    divider: "#c8c8c8",
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 16,
    h1: { fontSize: "24px", fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.01em" },
    h2: { fontSize: "20px", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.01em" },
    h3: { fontSize: "16px", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.01em" },
    h4: { fontSize: "30px", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.01em" },
    body1: { fontSize: "14px", fontWeight: 400, lineHeight: 1.5 },
    body2: { fontSize: "12px", fontWeight: 400, lineHeight: 1.5 },
    caption: { fontSize: "11px", fontWeight: 500, lineHeight: 1.4 },
    button: { textTransform: "none", fontWeight: 500, fontSize: "14px" },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      defaultProps: { variant: "contained", disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 44,
          padding: "0 16px",
          borderRadius: 6,
          transition: "background-color 150ms ease-in-out",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: 44, minHeight: 44 },
      },
    },
    MuiTextField: {
      defaultProps: { fullWidth: true, variant: "outlined", size: "small" },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { minHeight: 44 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 6,
          backgroundColor: "#FAFAFA",
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#2E7D32" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#2E7D32",
            boxShadow: "0 0 0 2px #e0ece0, 0 0 0 4px #2E7D32",
          },
        },
        notchedOutline: { borderColor: "#c8c8c8" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: "1px solid #c8c8c8",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          transition: "box-shadow 200ms ease-out, transform 200ms ease-out",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: "11px", borderRadius: 9999 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        },
      },
    },
  },
});
